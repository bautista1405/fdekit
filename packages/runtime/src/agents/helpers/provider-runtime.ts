import { getString } from '@fdekit/core';
import type {
  AgentConfig,
  AgentProvider,
  DeploymentDefinition,
  ProviderConfig,
  ProviderRuntimeAdapter,
  ProviderRuntimeRegistry,
  ProviderToolResult,
  ProviderStep,
} from '@fdekit/core';
import { redactForGovernance } from '../../governance/index.js';
import { createMockProvider, type MockPlanner, type MockProviderOptions } from '../../providers/mock.js';
import type { TraceEvent } from '../../traces/index.js';
import { appendAudit } from './audit.js';
import { callTool } from './tool-runner.js';
import type { RunState } from './types.js';

interface SteeringState {
  enabled: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  feedback: ProviderToolResult[];
}

export async function runProviderLoop(state: RunState, maxSteps: number): Promise<string> {
  const steering = createSteeringState(state);

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    const step = await state.provider.planNextStep({
      deployment: state.deployment,
      agentName: state.agentName,
      agent: state.agent,
      input: state.input,
      instructions: state.instructions,
      toolResults: [
        ...state.toolCalls,
        ...steering.feedback,
      ],
      stepIndex,
      maxSteps,
    });

    state.events.push(providerStepEvent(state.provider.name, step, stepIndex));

    if (step.type === 'final') {
      return step.message;
    }

    if (steering.enabled && isRepeatedToolCall(state, step)) {
      const message = repeatedToolCallMessage(step.toolName, step.args);

      if (steering.attemptsUsed < steering.maxAttempts) {
        steering.attemptsUsed += 1;
        steering.feedback.push(steeringToolResult(step, message, steering));
        await recordSteeringEvent(state, step, stepIndex, steering, message, 'requested');
        continue;
      }

      await recordSteeringEvent(state, step, stepIndex, steering, message, 'blocked');
      throw new Error(message);
    }

    await callTool(state, step.toolName, step.args);
  }

  throw new Error(`Agent run exceeded max steps (${maxSteps}) before producing a final answer`);
}

function createSteeringState(state: RunState): SteeringState {
  const steer = state.agent.harness?.steer ?? state.deployment.harness?.steer;

  if (!steer || steer.enabled === false) {
    return {
      enabled: false,
      attemptsUsed: 0,
      maxAttempts: 0,
      feedback: [],
    };
  }

  return {
    enabled: true,
    attemptsUsed: 0,
    maxAttempts: normalizeMaxAttempts(steer.maxAttempts),
    feedback: [],
  };
}

function normalizeMaxAttempts(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 1;
}

function isRepeatedToolCall(state: RunState, step: Extract<ProviderStep, { type: 'tool_call' }>): boolean {
  const nextSignature = toolCallSignature(step.toolName, redactForGovernance(step.args));

  return state.toolCalls.some((call) => toolCallSignature(call.name, call.args) === nextSignature);
}

function toolCallSignature(toolName: string, args: unknown): string {
  return `${toolName}:${stableStringify(args)}`;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortForStableStringify(value));
}

function sortForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableStringify);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => [key, sortForStableStringify(nested)]));
}

function repeatedToolCallMessage(toolName: string, args: Record<string, unknown>): string {
  return `Harness steering stopped repeated tool call ${toolName} with identical args ${stableStringify(redactForGovernance(args))}`;
}

function steeringToolResult(
  step: Extract<ProviderStep, { type: 'tool_call' }>,
  message: string,
  steering: SteeringState,
): ProviderToolResult {
  return {
    name: step.toolName,
    args: redactForGovernance(step.args),
    result: {
      error: {
        name: 'HarnessSteering',
        message,
      },
      guidance: 'Choose a different next tool call or produce a final answer from the existing evidence.',
      attempt: steering.attemptsUsed,
      maxAttempts: steering.maxAttempts,
    },
    latencyMs: 0,
    is_error: true,
  };
}

async function recordSteeringEvent(
  state: RunState,
  step: Extract<ProviderStep, { type: 'tool_call' }>,
  stepIndex: number,
  steering: SteeringState,
  message: string,
  outcome: 'requested' | 'blocked',
): Promise<void> {
  const redactedArgs = redactForGovernance(step.args);
  const type = outcome === 'blocked'
    ? 'harness.steer.blocked'
    : 'harness.steer.triggered';

  state.events.push({
    type,
    message,
    stepIndex,
    toolName: step.toolName,
    args: redactedArgs,
    reason: 'repeated_tool_call',
    attempt: steering.attemptsUsed,
    maxAttempts: steering.maxAttempts,
  });
  await appendAudit(state, {
    action: type,
    outcome,
    toolName: step.toolName,
    message,
    metadata: {
      reason: 'repeated_tool_call',
      stepIndex,
      args: redactedArgs,
      attempt: steering.attemptsUsed,
      maxAttempts: steering.maxAttempts,
    },
  });
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
