import {
  denyPIILeak,
  limitCost,
  limitToolScopes,
  redactSecrets,
  restrictEnvironments,
} from '@fdekit/core';
import type {
  AgentConfig,
  DeploymentDefinition,
  GovernanceDefinition,
  PolicyDecision,
  PolicyDefinition,
  PolicyResult,
  ToolCallContext,
} from '@fdekit/core';
import { findApproval, requestApproval } from '../../governance/index.js';
import type { ApprovalArtifact } from '../../governance/index.js';
import { appendAudit } from './audit.js';
import type { RunState, ToolPolicyPhase } from './types.js';

export async function enforcePolicies(
  state: RunState,
  phase: ToolPolicyPhase,
  toolName: string,
  value: unknown,
  context: ToolCallContext,
): Promise<void> {
  for (const policy of state.policies) {
    const handler = policy[phase];

    if (!handler) {
      continue;
    }

    const decision = normalizePolicyDecision(await handler(toolName, value, context));

    state.events.push({
      type: 'policy.evaluated',
      phase,
      policy: policy.name,
      toolName,
      allowed: decision.allowed,
      reason: decision.reason,
      approvalRequired: decision.approvalRequired,
      metadata: decision.metadata,
    });
    await appendAudit(state, {
      action: 'policy.evaluated',
      outcome: decision.allowed ? 'allowed' : decision.approvalRequired ? 'requested' : 'blocked',
      toolName,
      policy: policy.name,
      message: decision.reason,
      metadata: {
        phase,
        allowed: decision.allowed,
        approvalRequired: decision.approvalRequired,
        value,
        policyMetadata: decision.metadata,
      },
    });

    if (!decision.allowed) {
      if (decision.approvalRequired) {
        const approval = await resolveApproval(state, policy.name, phase, toolName, value, decision);

        state.events.push({
          type: approval.status === 'approved' ? 'approval.satisfied' : 'approval.requested',
          approvalId: approval.id,
          approvalStatus: approval.status,
          phase,
          policy: policy.name,
          toolName,
          reason: approval.reason,
        });

        if (approval.status === 'approved') {
          await appendAudit(state, {
            action: 'approval.satisfied',
            outcome: 'allowed',
            toolName,
            policy: policy.name,
            approvalId: approval.id,
            message: `Approval ${approval.id} allows ${toolName}`,
          });
          continue;
        }

        const approvalViolation = {
          policy: policy.name,
          phase,
          toolName,
          reason: approval.status === 'rejected'
            ? `Approval "${approval.id}" was rejected`
            : approval.reason,
          approvalRequired: true,
          approvalId: approval.id,
        };

        state.policyViolations.push(approvalViolation);
        throw new ApprovalRequiredError(approval);
      }

      const violation = {
        policy: policy.name,
        phase,
        toolName,
        reason: decision.reason,
        approvalRequired: decision.approvalRequired,
      };

      state.policyViolations.push(violation);
      await appendAudit(state, {
        action: 'policy.blocked',
        outcome: 'blocked',
        toolName,
        policy: policy.name,
        message: decision.reason,
      });
      throw new Error(`Policy "${policy.name}" blocked ${toolName}: ${decision.reason ?? 'no reason provided'}`);
    }
  }
}

export class ApprovalRequiredError extends Error {
  constructor(public readonly approval: ApprovalArtifact) {
    super(`Approval required for ${approval.toolName}; request ${approval.id} is ${approval.status}`);
    this.name = 'ApprovalRequiredError';
  }
}

export function collectRunPolicies(
  deployment: DeploymentDefinition,
  agentName: string,
  agent: AgentConfig,
): PolicyDefinition[] {
  return [
    ...policiesFromGovernance(deployment.governance, { scope: 'deployment', agentName }),
    ...(deployment.policies ?? []),
    ...policiesFromGovernance(agent.governance, { scope: `agent:${agentName}`, agentName }),
    ...(agent.policies ?? []),
  ];
}

function permissionScopes(governance: GovernanceDefinition | undefined, agentName: string): string[] {
  const permissions = governance?.permissions;

  return [
    ...(permissions?.allowedScopes ?? []),
    ...(permissions?.scopes?.map((scope) => scope.name) ?? []),
    ...(permissions?.grants ?? [])
      .filter((grant) => !grant.agent || grant.agent === agentName)
      .flatMap((grant) => grant.scopes),
  ];
}

export function governanceProfileEvent(
  deployment: DeploymentDefinition,
  agentName: string,
  agent: AgentConfig,
  policies: PolicyDefinition[],
): Record<string, unknown> {
  const governance = deployment.governance;
  const agentGovernance = agent.governance;
  const permissions = [
    ...permissionScopes(governance, agentName),
    ...permissionScopes(agentGovernance, agentName),
  ];

  return {
    auditEnabled: deployment.governance?.audit?.enabled !== false,
    environment: deployment.environment ?? 'local',
    agent: agentName,
    policyCount: policies.length,
    budgetCaps: [
      ...(governance?.budgets ?? []),
      ...(agentGovernance?.budgets ?? []),
    ].map((budget) => ({
      scope: budget.scope ?? 'deployment',
      maxUsd: budget.maxUsd,
      name: budget.name ?? 'limit-cost',
    })),
    allowedScopes: [...new Set(permissions)].sort(),
    dataProtection: {
      denyPII: Boolean(governance?.dataProtection?.denyPII || agentGovernance?.dataProtection?.denyPII),
      redactSecrets: Boolean(governance?.dataProtection?.redactSecrets || agentGovernance?.dataProtection?.redactSecrets),
    },
  };
}

async function resolveApproval(
  state: RunState,
  policy: string,
  phase: ToolPolicyPhase,
  toolName: string,
  value: unknown,
  decision: PolicyDecision,
): Promise<ApprovalArtifact> {
  const input = {
    deployment: state.deployment.name,
    environment: state.deployment.environment,
    agent: state.agentName,
    runId: state.runId,
    traceId: state.runId,
    policy,
    phase,
    toolName,
    args: value,
    reason: decision.reason,
  };
  const existing = await findApproval(state.projectDir, input, state.artifactStore);
  const approval = existing ?? await requestApproval(state.projectDir, input, state.artifactStore);

  if (!state.approvals.some((candidate) => candidate.id === approval.id)) {
    state.approvals.push(approval);
  }

  return approval;
}

function policiesFromGovernance(
  governance: GovernanceDefinition | undefined,
  context: { scope: string; agentName: string },
): PolicyDefinition[] {
  if (!governance) {
    return [];
  }

  const policies: PolicyDefinition[] = [];
  const dataProtection = governance.dataProtection;

  if (dataProtection?.denyPII) {
    const options = typeof dataProtection.denyPII === 'object' ? dataProtection.denyPII : {};
    policies.push(denyPIILeak(options));
  }

  if (dataProtection?.redactSecrets) {
    const options = typeof dataProtection.redactSecrets === 'object' ? dataProtection.redactSecrets : {};
    policies.push(redactSecrets(options));
  }

  if (governance.environments?.allowed?.length || governance.environments?.denied?.length || governance.environments?.tools?.length) {
    policies.push(restrictEnvironments({
      allowed: governance.environments.allowed,
      denied: governance.environments.denied,
      tools: governance.environments.tools,
      description: governance.environments.description,
    }));
  }

  for (const policy of permissionPoliciesFromGovernance(governance, context.agentName)) {
    policies.push(policy);
  }

  for (const budget of governance.budgets ?? []) {
    if (!budgetAppliesToAgent(budget.scope, context.agentName)) {
      continue;
    }

    const policy = limitCost({
      maxUsd: budget.maxUsd,
      name: budget.name,
      description: budget.description,
    });

    policies.push({
      ...policy,
      metadata: {
        ...policy.metadata,
        governanceScope: budget.scope ?? context.scope,
      },
    });
  }

  return policies;
}

function permissionPoliciesFromGovernance(
  governance: GovernanceDefinition,
  agentName: string,
): PolicyDefinition[] {
  const permissions = governance.permissions;

  if (!permissions) {
    return [];
  }

  const grants = (permissions.grants ?? []).filter((grant) => !grant.agent || grant.agent === agentName);

  if (grants.length > 0) {
    return grants.map((grant) => limitToolScopes({
      name: grant.name,
      description: grant.description,
      allowed: grant.scopes,
      denied: grant.deniedScopes,
      tools: grant.tools,
      requireScopes: grant.requireScopes ?? permissions.requireScopes,
    }));
  }

  const allowed = permissions.allowedScopes?.length
    ? permissions.allowedScopes
    : permissions.scopes?.map((scope) => scope.name) ?? [];

  if (allowed.length === 0 && !permissions.deniedScopes?.length && !permissions.requireScopes) {
    return [];
  }

  return [limitToolScopes({
    allowed,
    denied: permissions.deniedScopes,
    requireScopes: permissions.requireScopes,
  })];
}

function budgetAppliesToAgent(scope: string | undefined, agentName: string): boolean {
  return !scope || scope === 'deployment' || scope === `agent:${agentName}`;
}

function normalizePolicyDecision(result: PolicyResult): PolicyDecision {
  if (typeof result === 'boolean') {
    return { allowed: result };
  }

  return result;
}
