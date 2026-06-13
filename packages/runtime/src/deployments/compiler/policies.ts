import type { DeploymentDefinition, GovernanceDefinition, PolicyDefinition } from '@fdekit/core';
import type { CompiledPolicyPlan } from '../interfaces/index.js';
import { budgetAppliesToAgent } from './shared.js';

export function compilePoliciesForAgent(
  deployment: DeploymentDefinition,
  agentName: string,
): CompiledPolicyPlan[] {
  const agent = deployment.agents[agentName];

  return [
    ...compileGovernancePolicies(deployment.governance, 'deployment-governance', 'deployment', agentName),
    ...(deployment.policies ?? []).map((policy) => compilePolicy(policy, 'deployment', 'deployment')),
    ...compileGovernancePolicies(agent?.governance, 'agent-governance', `agents${agentName}`, agentName),
    ...(agent?.policies ?? []).map((policy) => compilePolicy(policy, 'agent', `agents${agentName}`)),
  ].filter((policy) => policy.name);
}

function compileGovernancePolicies(
  governance: GovernanceDefinition | undefined,
  source: CompiledPolicyPlan['source'],
  owner: string,
  agentName: string,
): CompiledPolicyPlan[] {
  if (!governance) {
    return [];
  }

  const policies: CompiledPolicyPlan[] = [];
  const dataProtection = governance.dataProtection;

  if (dataProtection?.denyPII) {
    policies.push({ name: 'deny-pii-leak', source, owner });
  }

  if (dataProtection?.redactSecrets) {
    policies.push({ name: 'redact-secrets', source, owner });
  }

  if (governance.environments?.allowed?.length || governance.environments?.denied?.length || governance.environments?.tools?.length) {
    policies.push({ name: 'restrict-environments', source, owner });
  }

  policies.push(...compilePermissionPolicies(governance, source, owner, agentName));

  for (const budget of governance.budgets ?? []) {
    if (budgetAppliesToAgent(budget.scope, agentName)) {
      policies.push({ name: budget.name ?? 'limit-cost', source, owner });
    }
  }

  return policies;
}

function compilePermissionPolicies(
  governance: GovernanceDefinition,
  source: CompiledPolicyPlan['source'],
  owner: string,
  agentName: string,
): CompiledPolicyPlan[] {
  const permissions = governance.permissions;

  if (!permissions) {
    return [];
  }

  const grants = (permissions.grants ?? []).filter((grant) => !grant.agent || grant.agent === agentName);

  if (grants.length > 0) {
    return grants.map((grant) => ({
      name: grant.name ?? 'limit-tool-scopes',
      source,
      owner,
    }));
  }

  const allowed = permissions.allowedScopes?.length
    ? permissions.allowedScopes
    : permissions.scopes?.map((scope) => scope.name) ?? [];

  return allowed.length > 0 || Boolean(permissions.deniedScopes?.length) || Boolean(permissions.requireScopes)
    ? [{ name: 'limit-tool-scopes', source, owner }]
    : [];
}

function compilePolicy(
  policy: PolicyDefinition,
  source: CompiledPolicyPlan['source'],
  owner: string,
): CompiledPolicyPlan {
  return {
    name: policy.name,
    source,
    owner,
  };
}
