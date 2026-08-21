import { createHash, randomBytes, randomUUID } from 'node:crypto';
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
  InputRequestRecord,
  StepContextPlan,
} from '@fdekit/core';
import { redactForGovernance } from '../../governance/index.js';
import { createMockProvider, type MockPlanner, type MockProviderOptions } from '../../providers/mock.js';
import type { TraceEvent } from '../../traces/index.js';
import { appendAudit } from './audit.js';
import {
  compileRunStepContext,
  enforceContextPlannedTool,
  type ContextInferenceRoute,
} from './context-planning.js';
import { callTool } from './tool-runner.js';
import { recordRunEvent } from './session-events.js';
import type { RunState } from './types.js';
import { recordProviderUsage } from './usage.js';

interface SteeringState {
  enabled: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  feedback: ProviderToolResult[];
}

export class InputRequiredError extends Error {
  constructor(readonly request: InputRequestRecord) {
    super(request.prompt);
    this.name = 'InputRequiredError';
  }
}

export async function runProviderLoop(state: RunState, maxSteps: number, startStep = 0): Promise<string> {
  const steering = createSteeringState(state);

  for (let stepIndex = startStep; stepIndex < maxSteps; stepIndex += 1) {
    state.lastStepIndex = stepIndex;
    const contextPlan = await compileRunStepContext(state, stepIndex);
    const providerStartedAt = Date.now();
    const step = await state.provider.planNextStep({
      deployment: contextPlan ? providerBoundaryDeployment(state.deployment) : state.deployment,
      agentName: state.agentName,
      agent: contextPlan ? { instructions: '' } : state.agent,
      input: contextPlan ? {} : state.input,
      instructions: contextPlan ? '' : state.instructions,
      toolResults: contextPlan ? [] : [
        ...state.toolCalls,
        ...state.inputAnswers,
        ...steering.feedback,
      ],
      stepIndex,
      maxSteps,
      outputTokenLimit: contextPlan
        ? Math.min(
          contextPlan.budget.maxOutputTokens ?? contextPlan.target.capabilities.maxOutputTokens,
          contextPlan.target.capabilities.maxOutputTokens,
        )
        : undefined,
      modelContext: contextPlan?.model,
    });

    await recordRunEvent(state, providerStepEvent(state.provider.name, step, stepIndex, contextPlan));
    await recordProviderUsage(state, step, contextPlan, Date.now() - providerStartedAt, stepIndex);

    if (step.type === 'final') {
      return step.message;
    }

    if (step.type === 'input_request') {
      const deadlineAt = state.inputGate?.deadlineAt;
      if (deadlineAt) {
        const deadline = Date.parse(deadlineAt);
        if (!Number.isFinite(deadline)) throw new Error(`Invalid input deadlineAt: ${deadlineAt}`);
        if (deadline <= Date.now()) throw new Error(`Input deadline ${deadlineAt} has already elapsed`);
      }
      const inputResumeToken = state.inputGate?.requireResumeToken
        ? randomBytes(32).toString('base64url')
        : undefined;
      const request: InputRequestRecord = {
        schemaVersion: 1,
        requestId: randomUUID(),
        identity: contextPlan?.identity ?? {
          taskId: state.taskId,
          runId: state.runId,
          attemptId: state.attemptId,
          stepId: `${state.runId}:step:${stepIndex}`,
        },
        session: { sessionId: state.runId, revision: state.sessionRevision },
        status: 'pending',
        prompt: step.prompt,
        inputSchema: step.inputSchema,
        requestedAt: new Date().toISOString(),
        requestedBy: { id: state.agentName, kind: 'system' },
        ...(state.inputGate?.audience ? { audience: state.inputGate.audience } : {}),
        ...(state.inputGate?.disclosure ?? step.disclosure
          ? { disclosure: state.inputGate?.disclosure ?? step.disclosure }
          : {}),
        ...(deadlineAt ? { deadlineAt } : {}),
        ...(inputResumeToken ? {
          resumeTokenDigest: `sha256:${createHash('sha256').update(inputResumeToken).digest('hex')}`,
        } : {}),
        ...(step.defaultValue === undefined ? {} : { defaultValue: step.defaultValue }),
      };
      state.inputRequests.push(request);
      state.pendingInput = request;
      state.inputResumeToken = inputResumeToken;
      await recordRunEvent(state, {
        type: 'input.requested',
        requestId: request.requestId,
        prompt: request.prompt,
        disclosure: request.disclosure,
        inputSchema: request.inputSchema,
        stepIndex,
      }, 'needs_input');
      throw new InputRequiredError(request);
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

    await enforceContextPlannedTool(state, step.toolName, stepIndex);
    await callTool(state, step.toolName, step.args);
  }

  throw new Error(`Agent run exceeded max steps (${maxSteps}) before producing a final answer`);
}

function providerBoundaryDeployment(deployment: DeploymentDefinition): DeploymentDefinition {
  return {
    name: deployment.name,
    environment: deployment.environment,
    providers: {},
    agents: {},
  };
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

  await recordRunEvent(state, {
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
  route?: ContextInferenceRoute,
): Promise<AgentProvider> {
  const providerName = route?.provider ?? agent.provider ?? 'mock';
  const providerAlias = route?.endpointId && deployment.providers[route.endpointId]
    ? route.endpointId
    : providerName;
  const configured = deployment.providers[providerAlias]
    ?? Object.values(deployment.providers).find((candidate) => candidate.name === providerName);
  const providerConfig = configured
    ? {
      ...configured,
      model: route?.model ?? agent.model ?? configured.model,
    }
    : undefined;

  if (route && providerConfig && providerConfig.name !== route.provider) {
    throw new Error(
      `Inference endpoint ${route.endpointId} is configured as ${providerConfig.name}, not ${route.provider}`,
    );
  }

  if (providerConfig?.runtime) {
    return resolveRuntimeAdapter(providerConfig.runtime, providerConfig);
  }

  const registryAdapter = providerRuntimeFromRegistry(providerName, providerConfig, registry);

  if (registryAdapter) {
    return resolveRuntimeAdapter(registryAdapter, providerConfig ?? {
      name: providerName,
      model: route?.model ?? agent.model,
    });
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

function providerStepEvent(
  provider: string,
  step: ProviderStep,
  stepIndex: number,
  contextPlan?: StepContextPlan,
): TraceEvent {
  const route = contextPlan ? {
    targetId: contextPlan.target.id,
    endpointId: contextPlan.endpoint.id,
    model: contextPlan.target.model,
  } : {};

  if (step.type === 'final') {
    return {
      type: 'provider.step.final',
      provider,
      stepIndex,
      ...route,
      message: step.message,
      metadata: step.metadata,
    };
  }

  if (step.type === 'input_request') {
    return {
      type: 'provider.step.input_requested',
      provider,
      stepIndex,
      ...route,
      prompt: step.prompt,
      disclosure: step.disclosure,
      metadata: step.metadata,
    };
  }

  return {
    type: 'provider.step.tool_call',
    provider,
    stepIndex,
    ...route,
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
