import type {
  AgentConfig,
  DeploymentDefinition,
  ProviderRuntimeRegistry,
} from '@fdekit/core';
import type {
  CompiledAgentPlan,
  CompiledConnectorPlan,
  CompiledEvalPlan,
  CompiledProviderPlan,
  CompiledToolPlan,
  DeploymentValidationIssue,
} from '../interfaces/index.js';
import { compileTool } from './connectors.js';
import { evalNamesForAgent } from './evals.js';
import { compileHarness } from './harness.js';
import { compilePoliciesForAgent } from './policies.js';
import { compareByName, resolveProviderRuntime, sortedEntries, type KnownRefs } from './shared.js';

export function compileAgents(
  deployment: DeploymentDefinition,
  providers: Record<string, CompiledProviderPlan>,
  connectors: Record<string, CompiledConnectorPlan>,
  evals: Record<string, CompiledEvalPlan>,
  knownRefs: KnownRefs,
  registry: ProviderRuntimeRegistry,
  issues: DeploymentValidationIssue[],
): Record<string, CompiledAgentPlan> {
  return Object.fromEntries(sortedEntries(deployment.agents ?? {}).map(([name, agent]) => {
    const provider = compileAgentProvider(deployment, providers, name, agent, registry, issues);

    return [
      name,
      {
        name,
        instructions: agent.instructions,
        provider,
        maxSteps: agent.harness?.maxSteps ?? deployment.harness?.maxSteps,
        tools: compileAgentTools(connectors, name, agent),
        policies: compilePoliciesForAgent(deployment, name),
        evals: evalNamesForAgent(evals, name),
        harness: agent.harness ? compileHarness(agent.harness, knownRefs) : undefined,
      },
    ];
  }));
}

function compileAgentProvider(
  deployment: DeploymentDefinition,
  providers: Record<string, CompiledProviderPlan>,
  agentName: string,
  agent: AgentConfig,
  registry: ProviderRuntimeRegistry,
  issues: DeploymentValidationIssue[],
): CompiledAgentPlan['provider'] {
  const providerKey = agent.provider ?? 'mock';
  const configuredProvider = providers[providerKey];
  const runtime = configuredProvider?.runtime
    ?? resolveProviderRuntime(providerKey, deployment.providers?.[providerKey], registry);

  if (runtime.source === 'missing' || runtime.source === 'not-configured') {
    issues.push({
      severity: 'error',
      path: `agents.${agentName}.provider.runtime`,
      message: `Provider "${providerKey}" does not have a runtime adapter for execution`,
    });
  }

  return {
    key: providerKey,
    name: configuredProvider?.name ?? deployment.providers?.[providerKey]?.name ?? providerKey,
    model: agent.model ?? configuredProvider?.model ?? deployment.providers?.[providerKey]?.model,
    runtime,
  };
}

function compileAgentTools(
  connectors: Record<string, CompiledConnectorPlan>,
  agentName: string,
  agent: AgentConfig,
): CompiledToolPlan[] {
  const tools = new Map<string, CompiledToolPlan>();

  for (const connector of Object.values(connectors)) {
    for (const tool of connector.tools) {
      tools.set(tool.name, tool);
    }
  }

  for (const tool of agent.tools ?? []) {
    const plan = compileTool(tool, 'agent', `agents.${agentName}`);
    tools.set(plan.name, plan);
  }

  return [...tools.values()].sort(compareByName);
}
