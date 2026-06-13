import { getString } from '@fdekit/core';
import type {
  AgentConfig,
  AgentProvider,
  DeploymentDefinition,
  ProviderConfig,
  ProviderRuntimeAdapter,
  ProviderRuntimeRegistry,
  ProviderStep,
} from '@fdekit/core';
import { createMockProvider, type MockPlanner, type MockProviderOptions } from '../../providers/mock.js';
import type { TraceEvent } from '../../traces/index.js';
import { callTool } from './tool-runner.js';
import type { RunState } from './types.js';

export async function runProviderLoop(state: RunState, maxSteps: number): Promise<string> {
  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    const step = await state.provider.planNextStep({
      deployment: state.deployment,
      agentName: state.agentName,
      agent: state.agent,
      input: state.input,
      instructions: state.instructions,
      toolResults: state.toolCalls,
      stepIndex,
      maxSteps,
    });

    state.events.push(providerStepEvent(state.provider.name, step, stepIndex));

    if (step.type === 'final') {
      return step.message;
    }

    await callTool(state, step.toolName, step.args);
  }

  throw new Error(`Agent run exceeded max steps (${maxSteps}) before producing a final answer`);
}

export async function resolveProvider(
  deployment: DeploymentDefinition,
  agent: AgentConfig,
  registry: ProviderRuntimeRegistry = {},
): Promise<AgentProvider> {
  const providerName = agent.provider ?? 'mock';
  const providerConfig = deployment.providers[providerName];

  if (providerConfig?.runtime) {
    return resolveRuntimeAdapter(providerConfig.runtime, providerConfig);
  }

  const registryAdapter = providerRuntimeFromRegistry(providerName, providerConfig, registry);

  if (registryAdapter) {
    return resolveRuntimeAdapter(registryAdapter, providerConfig ?? { name: providerName });
  }

  if (providerName === 'mock' || providerConfig?.name === 'mock') {
    return createMockProvider(mockProviderOptions(providerConfig));
  }

  if (!providerConfig) {
    throw new Error(`Provider "${providerName}" is not configured in deployment "${deployment.name}"`);
  }

  throw new Error(
    `Provider "${providerName}" does not have a runtime adapter. `
    + 'Use a provider helper that sets ProviderConfig.runtime, or pass providerRegistry to runAgent/runEvals'
    + availableRegistryHint(registry),
  );
}

function providerStepEvent(provider: string, step: ProviderStep, stepIndex: number): TraceEvent {
  if (step.type === 'final') {
    return {
      type: 'provider.step.final',
      provider,
      stepIndex,
      message: step.message,
      metadata: step.metadata,
    };
  }

  return {
    type: 'provider.step.tool_call',
    provider,
    stepIndex,
    toolName: step.toolName,
    args: step.args,
    reason: step.reason,
    metadata: step.metadata,
  };
}

async function resolveRuntimeAdapter(
  adapter: ProviderRuntimeAdapter,
  config: ProviderConfig,
): Promise<AgentProvider> {
  return typeof adapter === 'function'
    ? adapter(config)
    : adapter;
}

function providerRuntimeFromRegistry(
  providerName: string,
  providerConfig: ProviderConfig | undefined,
  registry: ProviderRuntimeRegistry,
): ProviderRuntimeAdapter | undefined {
  return registry[providerName] ?? (providerConfig ? registry[providerConfig.name] : undefined);
}

function availableRegistryHint(registry: ProviderRuntimeRegistry): string {
  const names = Object.keys(registry).sort();

  return names.length > 0
    ? ` Available registry providers: ${names.map((name) => `"${name}"`).join(', ')}`
    : '';
}

function mockProviderOptions(config: ProviderConfig | undefined): MockProviderOptions {
  const planner = config?.options?.planner;

  if (planner !== undefined && typeof planner !== 'function') {
    throw new Error('Mock provider options.planner must be a function');
  }

  return {
    name: config?.name ?? 'mock',
    planner: planner as MockPlanner | undefined,
    message: getString(config?.options?.message),
  };
}
