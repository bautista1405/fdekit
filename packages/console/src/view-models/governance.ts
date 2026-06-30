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
  EnforcementPostureItem,
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
  enforcementMode: 'enforced' | 'advisory' | 'unknown',
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
  const advisory = enforcementMode === 'advisory';

  return [
    {
      label: 'Audit Logs',
      status: auditEnabled ? advisory ? 'advisory' : 'pass' : 'fail',
      detail: auditEnabled
        ? governancePostureDetail(`${auditEventCount} event(s) captured${retention ? `, ${retention} day retention` : ''}`, advisory)
        : 'audit logging disabled',
    },
    {
      label: 'Environment Separation',
      status: governancePostureStatus(
        allowedEnvironments.length > 0 || deniedEnvironments.length > 0 || environmentPolicy !== undefined,
        advisory,
      ),
      detail: governancePostureDetail(allowedEnvironments.length > 0
        ? `Allowed: ${allowedEnvironments.join(', ')}`
        : deniedEnvironments.length > 0
          ? `Denied: ${deniedEnvironments.join(', ')}`
          : environmentPolicy?.detail ?? 'no environment policy configured', advisory),
    },
    {
      label: 'Permission Scopes',
      status: governancePostureStatus(uniqueScopes.length > 0 || permissionPolicy !== undefined, advisory),
      detail: governancePostureDetail(uniqueScopes.length > 0
        ? uniqueScopes.join(', ')
        : permissionPolicy?.detail ?? 'no tool scope grants configured', advisory),
    },
    {
      label: 'Data Protection',
      status: dataProtectionEnabled ? advisory ? 'advisory' : 'pass' : 'warn',
      detail: dataProtectionEnabled
        ? [
          governance?.dataProtection?.denyPII ? 'PII denial' : '',
          governance?.dataProtection?.redactSecrets ? 'secret redaction' : '',
          dataPolicyCount > 0 ? `${dataPolicyCount} policy item(s)` : '',
        ].filter(Boolean).join(', ') + (advisory ? ', advisory mode - not enforced' : '')
        : 'no PII or secret handling configured',
    },
    {
      label: 'Budget Caps',
      status: budgets.length > 0 ? advisory ? 'advisory' : 'pass' : 'warn',
      detail: budgets.length > 0
        ? governancePostureDetail(budgets.map((budget) => `${budget.scope} $${budget.maxUsd.toFixed(4)}`).join(', '), advisory)
        : 'no cost ceiling configured',
    },
  ];
}

function governancePostureStatus(configured: boolean, advisory: boolean): GovernancePostureItem['status'] {
  if (!configured) {
    return 'warn';
  }

  return advisory ? 'advisory' : 'pass';
}

function governancePostureDetail(detail: string, advisory: boolean): string {
  return advisory ? `${detail}, advisory mode - not enforced` : detail;
}

export function collectEnforcementPosture(traces: TraceArtifact[]): {
  enforcementPosture: EnforcementPostureItem[];
  enforcementMode: 'enforced' | 'advisory' | 'unknown';
} {
  const edgeProfile = latestEventOfType(traces, 'runtime.edge.profile');
  const governanceProfile = latestEventOfType(traces, 'governance.profile');
  const edge = asRecord(edgeProfile);
  const governance = asRecord(governanceProfile);
  const dataProtection = asRecord(governance.dataProtection);
  const strict = getBoolean(edge.strict);
  const requireToolArgsSchema = getBoolean(edge.requireToolArgsSchema);
  const requireToolScopes = getBoolean(edge.requireToolScopes);
  const requireToolEnvironments = getBoolean(edge.requireToolEnvironments);
  const auditEnabled = getBoolean(governance.auditEnabled);
  const denyPII = getBoolean(dataProtection.denyPII);
  const redactSecrets = getBoolean(dataProtection.redactSecrets);
  const policyCount = getNumber(governance.policyCount);
  const allowedScopes = stringArray(governance.allowedScopes);
  const budgetCaps = Array.isArray(governance.budgetCaps) ? governance.budgetCaps.length : 0;
  const enforcementMode = strict === undefined
    ? 'unknown'
    : strict
      ? 'enforced'
      : 'advisory';

  return {
    enforcementMode,
    enforcementPosture: [
      enforcementItem(
        'Strict mode',
        strict,
        'Runtime edge gates enforced',
        'advisory mode - not enforced',
        'No runtime.edge.profile event captured',
      ),
      enforcementItem(
        'Argument schemas',
        requireToolArgsSchema,
        'Tool argsSchema metadata required',
        'schema metadata advisory - not enforced',
        'No runtime edge schema posture captured',
      ),
      enforcementItem(
        'Permission scopes',
        requireToolScopes,
        'Tool permission scopes required',
        'scope metadata advisory - not enforced',
        'No runtime edge scope posture captured',
      ),
      enforcementItem(
        'Environment gates',
        requireToolEnvironments,
        'Tool environment metadata required',
        'environment metadata advisory - not enforced',
        'No runtime edge environment posture captured',
      ),
      {
        label: 'Data protection',
        status: denyPII && redactSecrets ? 'pass' : 'warn',
        detail: [
          denyPII ? 'PII denial enabled' : 'PII denial not captured',
          redactSecrets ? 'secret redaction enabled' : 'secret redaction not captured',
        ].join(', '),
      },
      {
        label: 'Audit logging',
        status: auditEnabled === true ? 'pass' : auditEnabled === false ? 'fail' : 'warn',
        detail: auditEnabled === true
          ? profileInventoryDetail(policyCount, allowedScopes, budgetCaps)
          : auditEnabled === false
            ? 'audit disabled in governance profile'
            : 'No governance.profile audit posture captured',
      },
    ],
  };
}

function enforcementItem(
  label: string,
  enabled: boolean | undefined,
  enabledDetail: string,
  disabledDetail: string,
  missingDetail: string,
): EnforcementPostureItem {
  if (enabled === undefined) {
    return {
      label,
      status: 'warn',
      detail: missingDetail,
    };
  }

  return {
    label,
    status: enabled ? 'pass' : 'warn',
    detail: enabled ? enabledDetail : disabledDetail,
  };
}

function profileInventoryDetail(policyCount: number | undefined, allowedScopes: string[], budgetCaps: number): string {
  return [
    'audit enabled',
    policyCount === undefined ? '' : `${policyCount} policy item(s)`,
    allowedScopes.length > 0 ? `scopes: ${allowedScopes.join(', ')}` : '',
    budgetCaps > 0 ? `${budgetCaps} budget cap(s)` : '',
  ].filter(Boolean).join(', ');
}

function latestEventOfType(traces: TraceArtifact[], type: string): Record<string, unknown> | undefined {
  const sorted = [...traces].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  for (const trace of sorted) {
    for (const event of [...(trace.events ?? [])].reverse()) {
      if (event.type === type) {
        return event;
      }
    }
  }

  return undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
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
