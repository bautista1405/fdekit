import type {
  ContextBudget,
  InferenceTarget,
  ProviderStep,
  ProviderUsage,
  StepContextPlan,
  UsageMeasurement,
} from '@fdekit/core';
import { recordRunEvent } from './session-events.js';
import type { RunState } from './types.js';

export async function recordProviderUsage(
  state: RunState,
  step: ProviderStep,
  plan: StepContextPlan | undefined,
  latencyMs: number,
  stepIndex: number,
): Promise<UsageMeasurement> {
  const usage = normalizeUsage(step.usage);
  const cost = usage && plan ? estimateMeasuredCost(usage, plan.target) : undefined;
  const measurement: UsageMeasurement = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    identity: plan?.identity ?? {
      taskId: state.taskId,
      runId: state.runId,
      attemptId: state.attemptId,
      stepId: `${state.runId}:step:${stepIndex}`,
    },
    provider: plan?.target.provider ?? state.provider.name,
    ...(plan?.target.model ? { model: plan.target.model } : {}),
    ...(usage ?? {}),
    toolCalls: step.type === 'tool_call' ? 1 : 0,
    latencyMs,
    ...(cost !== undefined ? { cost: cost.value, currency: cost.currency } : {}),
    status: usage ? 'measured' : 'unknown',
    ...(cost !== undefined ? { metadata: { costStatus: 'estimated' } } : {}),
  };

  state.usage.push(measurement);
  if (cost?.currency.toUpperCase() === 'USD') {
    state.costUsd += cost.value;
  }
  await recordRunEvent(state, {
    type: 'provider.usage',
    stepIndex,
    ...measurement,
  });
  enforceMeasuredBudgets(state, measurement, plan?.budget);
  return measurement;
}

function normalizeUsage(usage: ProviderUsage | undefined): ProviderUsage | undefined {
  if (!usage) return undefined;

  const normalized: ProviderUsage = {};
  for (const key of [
    'inputTokens',
    'cachedInputTokens',
    'cacheWriteInputTokens',
    'outputTokens',
    'reasoningTokens',
  ] as const) {
    const value = usage[key];
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Provider usage ${key} must be a non-negative integer`);
    }
    normalized[key] = value;
  }
  const inputSubsets = (normalized.cachedInputTokens ?? 0) + (normalized.cacheWriteInputTokens ?? 0);
  if (normalized.inputTokens !== undefined && inputSubsets > normalized.inputTokens) {
    throw new Error(
      'Provider usage cachedInputTokens and cacheWriteInputTokens cannot exceed inputTokens',
    );
  }
  if (
    normalized.reasoningTokens !== undefined
    && normalized.outputTokens !== undefined
    && normalized.reasoningTokens > normalized.outputTokens
  ) {
    throw new Error('Provider usage reasoningTokens cannot exceed outputTokens');
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function estimateMeasuredCost(
  usage: ProviderUsage,
  target: InferenceTarget,
): { value: number; currency: string } | undefined {
  const pricing = target.pricing;
  if (!pricing || usage.inputTokens === undefined || usage.outputTokens === undefined) return undefined;

  const cached = usage.cachedInputTokens ?? 0;
  const cacheWrite = usage.cacheWriteInputTokens ?? 0;
  const uncached = usage.inputTokens - cached - cacheWrite;
  const cachedRate = pricing.cachedInputPerMillionTokens ?? pricing.inputPerMillionTokens;
  if (
    (uncached > 0 && pricing.inputPerMillionTokens === undefined)
    || (cached > 0 && cachedRate === undefined)
    || (cacheWrite > 0 && pricing.cacheWriteInputPerMillionTokens === undefined)
    || (usage.outputTokens > 0 && pricing.outputPerMillionTokens === undefined)
  ) {
    return undefined;
  }
  return {
    value: (
      uncached * (pricing.inputPerMillionTokens ?? 0)
      + cached * (cachedRate ?? 0)
      + cacheWrite * (pricing.cacheWriteInputPerMillionTokens ?? 0)
      + usage.outputTokens * (pricing.outputPerMillionTokens ?? 0)
    ) / 1_000_000,
    currency: pricing.currency,
  };
}

function enforceMeasuredBudgets(
  state: RunState,
  measurement: UsageMeasurement,
  budget: ContextBudget | undefined,
): void {
  if (!budget) return;

  const totalLatencyMs = state.usage.reduce((sum, entry) => sum + (entry.latencyMs ?? 0), 0);
  if (budget.maxLatencyMs !== undefined && totalLatencyMs > budget.maxLatencyMs) {
    throw new Error(
      `Inference latency budget exceeded: ${totalLatencyMs}ms used, limit ${budget.maxLatencyMs}ms`,
    );
  }
  if (budget.maxDurationMs !== undefined && Date.now() - state.startedAt > budget.maxDurationMs) {
    throw new Error(`Run duration budget exceeded: limit ${budget.maxDurationMs}ms`);
  }
  const totalToolCalls = state.usage.reduce((sum, entry) => sum + (entry.toolCalls ?? 0), 0);
  if (budget.maxToolCalls !== undefined && totalToolCalls > budget.maxToolCalls) {
    throw new Error(
      `Tool-call budget exceeded: ${totalToolCalls} requested, limit ${budget.maxToolCalls}`,
    );
  }

  if (
    budget.maxOutputTokens !== undefined
    && measurement.outputTokens !== undefined
    && measurement.outputTokens > budget.maxOutputTokens
  ) {
    throw new Error(
      `Inference output token budget exceeded: ${measurement.outputTokens} used, `
      + `limit ${budget.maxOutputTokens}`,
    );
  }
  if (
    budget.maxInputTokens !== undefined
    && measurement.inputTokens !== undefined
    && measurement.inputTokens > budget.maxInputTokens
  ) {
    throw new Error(
      `Inference input token budget exceeded: ${measurement.inputTokens} used, `
      + `limit ${budget.maxInputTokens}`,
    );
  }
  if (budget.maxCost !== undefined) {
    if (measurement.cost === undefined) {
      throw new Error(
        'Inference cost budget could not be verified because provider usage was unavailable or incomplete',
      );
    }
    const priced = state.usage.filter((entry) => entry.cost !== undefined && entry.currency);
    const currencies = [...new Set(priced.map((entry) => entry.currency))];
    if (currencies.length > 1) {
      throw new Error('Inference cost budget cannot aggregate multiple currencies');
    }
    const total = priced.reduce((sum, entry) => sum + (entry.cost ?? 0), 0);
    if (total > budget.maxCost) {
      throw new Error(
        `Inference cost budget exceeded: ${total} ${currencies[0]} used, `
        + `limit ${budget.maxCost} ${currencies[0]}`,
      );
    }
  }
}
