import type { DeploymentDefinition, GovernanceDefinition, HarnessDefinition } from '@fdekit/core';
import { collectEvals, type EvalArtifact } from './evals/index.js';
import type { TraceArtifact } from './traces/index.js';
import { joinNames } from './utils.js';

export function renderReport(
  deployment: DeploymentDefinition,
  latestEval: EvalArtifact | null,
  traces: TraceArtifact[],
): string {
  const providerNames = Object.keys(deployment.providers ?? {});
  const connectorNames = Object.keys(deployment.connectors ?? {});
  const agentNames = Object.keys(deployment.agents ?? {});

  return `# ${deployment.name} Deployment Report

Created: ${new Date().toISOString()}

## Summary

- Environment: ${deployment.environment ?? 'local'}
- Providers: ${joinNames(providerNames)}
- Connectors: ${joinNames(connectorNames)}
- Agents: ${joinNames(agentNames)}

## Governance

- Deployment policies: ${joinNames(collectReportPolicyNames(deployment))}
- Evals configured: ${collectEvals(deployment).length}

## Latest Eval

- Status: ${latestEval?.status ?? 'not run'}
- Suites: ${latestEval?.results?.length ?? 0}

## Observability

- Traces captured: ${traces.length}
- Latest trace: ${traces.length > 0 ? traces[traces.length - 1]?.id ?? 'none' : 'none'}
`;
}

export function collectReportPolicyNames(deployment: DeploymentDefinition): string[] {
  const policyNames: string[] = [];
  const agentNames = Object.keys(deployment.agents ?? {});
  const addPolicyName = (name: string | undefined) => {
    if (name && !policyNames.includes(name)) {
      policyNames.push(name);
    }
  };

  for (const policy of deployment.policies ?? []) {
    addPolicyName(policy.name);
  }

  collectGovernancePolicyNames(deployment.governance, agentNames, addPolicyName);
  collectHarnessPolicyRefs(deployment.harness, addPolicyName);

  for (const [agentName, agent] of Object.entries(deployment.agents ?? {})) {
    for (const policy of agent.policies ?? []) {
      addPolicyName(policy.name);
    }

    collectGovernancePolicyNames(agent.governance, [agentName], addPolicyName);
    collectHarnessPolicyRefs(agent.harness, addPolicyName);
  }

  return policyNames;
}

function collectGovernancePolicyNames(
  governance: GovernanceDefinition | undefined,
  agentNames: string[],
  addPolicyName: (name: string | undefined) => void,
): void {
  if (!governance) {
    return;
  }

  if (governance.dataProtection?.denyPII) {
    addPolicyName('deny-pii-leak');
  }

  if (governance.dataProtection?.redactSecrets) {
    addPolicyName('redact-secrets');
  }

  const environments = governance.environments;
  if (environments?.allowed?.length || environments?.denied?.length || environments?.tools?.length) {
    addPolicyName('restrict-environments');
  }

  collectPermissionPolicyNames(governance, agentNames, addPolicyName);

  for (const budget of governance.budgets ?? []) {
    if (budgetAppliesToAnyAgent(budget.scope, agentNames)) {
      addPolicyName(budget.name ?? 'limit-cost');
    }
  }
}

function collectPermissionPolicyNames(
  governance: GovernanceDefinition,
  agentNames: string[],
  addPolicyName: (name: string | undefined) => void,
): void {
  const permissions = governance.permissions;

  if (!permissions) {
    return;
  }

  const grants = (permissions.grants ?? [])
    .filter((grant) => !grant.agent || agentNames.includes(grant.agent));

  if (grants.length > 0) {
    for (const grant of grants) {
      addPolicyName(grant.name ?? 'limit-tool-scopes');
    }
    return;
  }

  const allowed = permissions.allowedScopes?.length
    ? permissions.allowedScopes
    : permissions.scopes?.map((scope) => scope.name) ?? [];

  if (allowed.length > 0 || permissions.deniedScopes?.length || permissions.requireScopes) {
    addPolicyName('limit-tool-scopes');
  }
}

function collectHarnessPolicyRefs(
  harness: HarnessDefinition | undefined,
  addPolicyName: (name: string | undefined) => void,
): void {
  for (const policyRef of harness?.policyRefs ?? []) {
    addPolicyName(policyRef);
  }

  for (const phase of harness?.phases ?? []) {
    for (const policyRef of phase.policyRefs ?? []) {
      addPolicyName(policyRef);
    }
  }
}

function budgetAppliesToAnyAgent(scope: string | undefined, agentNames: string[]): boolean {
  return !scope || scope === 'deployment' || agentNames.some((agentName) => scope === `agent:${agentName}`);
}
