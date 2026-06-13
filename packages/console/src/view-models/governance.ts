import {
  asRecord,
  getNumber,
  getString,
  isDefined,
  type DeploymentDefinition,
  type PolicyDefinition,
} from '@fdekit/core';
import type { ApprovalArtifact, TraceArtifact } from '@fdekit/runtime';
import type {
  ApprovalQueueItem,
  BudgetCapItem,
  GovernancePostureItem,
  PolicyDefinitionItem,
  PolicyEventItem,
} from '../interfaces/index.js';
import { stringArray } from './helpers.js';

export function collectPolicyEvents(traces: TraceArtifact[]): PolicyEventItem[] {
  return traces.flatMap((trace) => (trace.events ?? [])
    .filter((event) => event.type === 'policy.evaluated')
    .map((event) => ({
      policy: getString(event.policy) ?? 'unknown',
      toolName: getString(event.toolName) ?? 'unknown',
      phase: getString(event.phase),
      allowed: event.allowed === true,
      approvalRequired: event.approvalRequired === true,
      reason: getString(event.reason),
      traceId: trace.id,
      createdAt: trace.createdAt,
    })))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function collectPolicyDefinitions(deployment: DeploymentDefinition): PolicyDefinitionItem[] {
  const deploymentPolicies = (deployment.policies ?? []).map((policy) => policyDefinitionItem('deployment', policy));
  const agentPolicies = Object.entries(deployment.agents ?? {}).flatMap(([agentName, agent]) => (
    (agent.policies ?? []).map((policy) => policyDefinitionItem(`agent:${agentName}`, policy))
  ));

  return [...deploymentPolicies, ...agentPolicies];
}

export function collectBudgetCaps(policies: PolicyDefinitionItem[], deployment: DeploymentDefinition): BudgetCapItem[] {
  const policyBudgets = policies
    .map((policy) => {
      const maxUsdMatch = /Budget cap \$(\d+(?:\.\d+)?)/.exec(policy.detail);

      return maxUsdMatch
        ? {
          scope: policy.scope,
          policy: policy.name,
          maxUsd: Number(maxUsdMatch[1]),
        }
        : undefined;
    })
    .filter(isDefined);
  const governanceBudgets = [
    ...(deployment.governance?.budgets ?? []).map((budget) => ({
      scope: budget.scope ?? 'deployment',
      policy: budget.name ?? 'limit-cost',
      maxUsd: budget.maxUsd,
    })),
    ...Object.entries(deployment.agents ?? {}).flatMap(([agentName, agent]) => (
      (agent.governance?.budgets ?? []).map((budget) => ({
        scope: budget.scope ?? `agent:${agentName}`,
        policy: budget.name ?? 'limit-cost',
        maxUsd: budget.maxUsd,
      }))
    )),
  ];
  const seen = new Set<string>();

  return [...policyBudgets, ...governanceBudgets].filter((budget) => {
    const key = `${budget.scope}:${budget.policy}:${budget.maxUsd}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function collectGovernancePosture(
  deployment: DeploymentDefinition,
  policies: PolicyDefinitionItem[],
  budgets: BudgetCapItem[],
  auditEventCount: number,
): GovernancePostureItem[] {
  const governance = deployment.governance;
  const environmentPolicy = policies.find((policy) => policy.kind === 'environment-separation');
  const permissionPolicy = policies.find((policy) => policy.kind === 'tool-permissions');
  const dataPolicyCount = policies.filter((policy) => policy.kind === 'data-protection' || policy.kind === 'secret-redaction').length;
  const allowedEnvironments = governance?.environments?.allowed ?? [];
  const deniedEnvironments = governance?.environments?.denied ?? [];
  const declaredScopes = [
    ...(governance?.permissions?.allowedScopes ?? []),
    ...(governance?.permissions?.scopes?.map((scope) => scope.name) ?? []),
    ...(governance?.permissions?.grants ?? []).flatMap((grant) => grant.scopes),
  ];
  const uniqueScopes = [...new Set(declaredScopes)].sort();
  const dataProtectionEnabled = Boolean(governance?.dataProtection?.denyPII || governance?.dataProtection?.redactSecrets || dataPolicyCount > 0);
  const auditEnabled = governance?.audit?.enabled !== false;
  const retention = governance?.audit?.retentionDays;

  return [
    {
      label: 'Audit Logs',
      status: auditEnabled ? 'pass' : 'fail',
      detail: auditEnabled
        ? `${auditEventCount} event(s) captured${retention ? `, ${retention} day retention` : ''}`
        : 'audit logging disabled',
    },
    {
      label: 'Environment Separation',
      status: allowedEnvironments.length > 0 || deniedEnvironments.length > 0 || environmentPolicy ? 'pass' : 'warn',
      detail: allowedEnvironments.length > 0
        ? `Allowed: ${allowedEnvironments.join(', ')}`
        : deniedEnvironments.length > 0
          ? `Denied: ${deniedEnvironments.join(', ')}`
          : environmentPolicy?.detail ?? 'no environment policy configured',
    },
    {
      label: 'Permission Scopes',
      status: uniqueScopes.length > 0 || permissionPolicy ? 'pass' : 'warn',
      detail: uniqueScopes.length > 0
        ? uniqueScopes.join(', ')
        : permissionPolicy?.detail ?? 'no tool scope grants configured',
    },
    {
      label: 'Data Protection',
      status: dataProtectionEnabled ? 'pass' : 'warn',
      detail: dataProtectionEnabled
        ? [
          governance?.dataProtection?.denyPII ? 'PII denial' : '',
          governance?.dataProtection?.redactSecrets ? 'secret redaction' : '',
          dataPolicyCount > 0 ? `${dataPolicyCount} policy item(s)` : '',
        ].filter(Boolean).join(', ')
        : 'no PII or secret handling configured',
    },
    {
      label: 'Budget Caps',
      status: budgets.length > 0 ? 'pass' : 'warn',
      detail: budgets.length > 0
        ? budgets.map((budget) => `${budget.scope} $${budget.maxUsd.toFixed(4)}`).join(', ')
        : 'no cost ceiling configured',
    },
  ];
}

export function collectApprovalQueue(
  policyEvents: PolicyEventItem[],
  approvals: ApprovalArtifact[],
): ApprovalQueueItem[] {
  if (approvals.length > 0) {
    return [...approvals]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((approval) => ({
        policy: approval.policy,
        toolName: approval.toolName,
        status: approval.status === 'pending' ? 'pending approval' : approval.status,
        reason: approval.status === 'approved'
          ? approval.decisionReason ?? approval.reason
          : approval.status === 'rejected'
            ? approval.decisionReason ?? `Approval "${approval.id}" was rejected`
            : approval.reason,
        traceId: approval.traceId,
        createdAt: approval.updatedAt,
        approvalId: approval.id,
        decidedBy: approval.decidedBy,
        decisionReason: approval.decisionReason,
      }));
  }

  return policyEvents
    .filter((event) => !event.allowed || event.approvalRequired)
    .map((event) => ({
      policy: event.policy,
      toolName: event.toolName,
      status: event.approvalRequired ? 'pending approval' : 'blocked',
      reason: event.reason ?? (event.approvalRequired ? 'Approval required before this tool can run' : 'Policy blocked this tool call'),
      traceId: event.traceId,
      createdAt: event.createdAt,
    }));
}

function policyDefinitionItem(scope: string, policy: PolicyDefinition): PolicyDefinitionItem {
  const metadata = asRecord(policy.metadata);

  return {
    scope,
    name: policy.name,
    kind: getString(metadata.kind) ?? 'custom',
    description: policy.description ?? 'Custom policy',
    detail: policyMetadataDetail(metadata),
  };
}

function policyMetadataDetail(metadata: Record<string, unknown>): string {
  const maxUsd = getNumber(metadata.maxUsd);
  if (maxUsd !== undefined) {
    return `Budget cap $${maxUsd.toFixed(4)}`;
  }

  const maxCalls = getNumber(metadata.maxCalls);
  if (maxCalls !== undefined) {
    return `Max ${maxCalls} tool call(s)`;
  }

  const allowedScopes = stringArray(metadata.allowedScopes);
  if (allowedScopes.length > 0) {
    return `Allowed scopes: ${allowedScopes.join(', ')}`;
  }

  const allowedEnvironments = stringArray(metadata.allowedEnvironments);
  if (allowedEnvironments.length > 0) {
    return `Allowed environments: ${allowedEnvironments.join(', ')}`;
  }

  const allowedTables = stringArray(metadata.allowedTables);
  if (allowedTables.length > 0) {
    return `Allowed tables: ${allowedTables.join(', ')}`;
  }

  const tools = stringArray(metadata.tools);
  if (tools.length > 0) {
    return `Tools: ${tools.join(', ')}`;
  }

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : 'No structured metadata';
}
