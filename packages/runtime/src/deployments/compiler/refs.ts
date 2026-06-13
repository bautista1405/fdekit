import type { DeploymentDefinition } from '@fdekit/core';
import type { CompiledConnectorPlan, CompiledEvalPlan } from '../interfaces/index.js';
import { compilePoliciesForAgent } from './policies.js';
import { sortedEntries, type KnownRefs } from './shared.js';

export function collectKnownRefs(
  deployment: DeploymentDefinition,
  connectors: Record<string, CompiledConnectorPlan>,
  evals: Record<string, CompiledEvalPlan>,
): KnownRefs {
  const tools = new Map<string, string>();
  const policies = new Map<string, string>();
  const evalRefs = new Map<string, string>();

  for (const connector of Object.values(connectors)) {
    for (const tool of connector.tools) {
      tools.set(tool.name, tool.owner);
    }
  }

  for (const [agentName, agent] of sortedEntries(deployment.agents ?? {})) {
    for (const tool of agent.tools ?? []) {
      tools.set(tool.name, `agents${agentName}`);
    }

    for (const policy of compilePoliciesForAgent(deployment, agentName)) {
      policies.set(policy.name, policy.owner);
    }
  }

  for (const evalPlan of Object.values(evals)) {
    evalRefs.set(evalPlan.name, evalPlan.scope);
  }

  return { tools, policies, evals: evalRefs };
}
