import type {
  ContextBudget,
  ContextPlannerCandidate,
  InferenceEndpointReference,
  InferenceRouteRejection,
  InferenceTarget,
  StepContextPlan,
  ToolPlannerCandidate,
} from '@fdekit/core';
import {
  authorizeRetrieval,
  planStepContext,
  selectInferenceTarget,
} from '../../context/index.js';
import type { AgentContextPlanningOptions } from '../interfaces/index.js';
import { recordRunEvent } from './session-events.js';
import type { RunState } from './types.js';

export interface ContextInferenceRoute {
  endpointId: string;
  provider: string;
  model: string;
  target: InferenceTarget;
  endpoint: InferenceEndpointReference;
  rejected: InferenceRouteRejection[];
}

export function selectContextInferenceRoute(options: AgentContextPlanningOptions): ContextInferenceRoute {
  const allowedTargetIds = options.policy.targetAllowlist;
  const allowedRoutes = allowedTargetIds
    ? options.routes.filter((route) => allowedTargetIds.includes(route.target.id))
    : options.routes;
  const policyRejected = allowedTargetIds
    ? options.routes
      .filter((route) => !allowedTargetIds.includes(route.target.id))
      .map((route) => ({
        targetId: route.target.id,
        endpointId: route.endpoint.id,
        reasons: ['target_not_allowed'],
      }))
    : [];
  const selection = selectInferenceTarget(allowedRoutes, options.requirements);
  const rejected = [...policyRejected, ...selection.rejected];

  if (selection.status !== 'selected' || !selection.target || !selection.endpoint) {
    const detail = rejected
      .map((entry) => `${entry.targetId}/${entry.endpointId}: ${entry.reasons.join(', ')}`)
      .join('; ');
    throw new Error(`No policy-eligible inference target is available${detail ? ` (${detail})` : ''}`);
  }

  return {
    endpointId: selection.endpoint.id,
    provider: selection.target.provider,
    model: selection.target.model,
    target: selection.target,
    endpoint: selection.endpoint,
    rejected,
  };
}

export async function compileRunStepContext(
  state: RunState,
  stepIndex: number,
): Promise<StepContextPlan | undefined> {
  const options = state.contextPlanning;

  if (!options) return undefined;

  const route = selectContextInferenceRoute(options);
  const budget = remainingRunBudget(state, options.budget ?? options.policy.budget);
  enforceDurationBudget(state, budget);
  enforcePricedCostBudget(route.target, budget);
  const items = [
    requiredItem('fdekit:agent-instructions', 'instruction', state.instructions),
    requiredItem('fdekit:run-input', 'instruction', JSON.stringify(state.input)),
    ...state.toolCalls.map((call, index) => requiredItem(
      `fdekit:tool-result:${index}`,
      'recent_action',
      JSON.stringify({
        toolName: call.name,
        args: call.args,
        result: call.result,
        is_error: call.is_error ?? false,
      }),
    )),
    ...state.inputAnswers.map((answer, index) => requiredItem(
      `fdekit:input-answer:${index}`,
      'recent_action',
      JSON.stringify({
        request: answer.args,
        answer: answer.result,
      }),
      'input_answer',
    )),
    ...(options.items ?? []),
  ];
  const tools = contextToolCandidates(state, options);
  const requestedSourceIds = options.requestedSourceIds
    ?? [...new Set((options.items ?? []).flatMap((candidate) => (
      candidate.sourceIds ?? candidate.item.sourceIds ?? []
    )))];
  const authorization = authorizeRetrieval({
    policy: options.policy,
    requestedSourceIds,
  });
  const plan = planStepContext({
    identity: {
      taskId: state.taskId,
      runId: state.runId,
      attemptId: state.attemptId,
      stepId: `${state.runId}:step:${stepIndex}`,
    },
    target: route.target,
    endpoint: route.endpoint,
    policy: options.policy,
    authorization,
    budget,
    objectives: options.objectives,
    items,
    skills: options.skills,
    tools,
    compression: options.compression,
  });

  state.activeContextPlan = plan;
  await recordRunEvent(state, contextPlanEvent(
    plan,
    route.rejected,
    stepIndex,
    {
      version: options.policy.version,
      fingerprint: options.policy.fingerprint,
      decision: options.policy.decision,
    },
  ));

  if (plan.feasibility.status !== 'feasible') {
    throw new Error(
      `Context plan for step ${stepIndex} is ${plan.feasibility.status}: `
      + (plan.feasibility.reasons.join(' ') || 'no eligible model context'),
    );
  }

  return plan;
}

export async function enforceContextPlannedTool(
  state: RunState,
  toolName: string,
  stepIndex: number,
): Promise<void> {
  const plan = state.activeContextPlan;

  if (!plan || plan.model.tools.some((tool) => tool.name === toolName)) return;

  await recordRunEvent(state, {
    type: 'context.plan.tool_blocked',
    message: `Context plan blocked unselected tool ${toolName}`,
    stepIndex,
    toolName,
    targetId: plan.target.id,
    endpointId: plan.endpoint.id,
    policyFingerprint: state.contextPlanning?.policy.fingerprint,
  });
  throw new Error(`Context plan does not allow tool "${toolName}" at step ${stepIndex}`);
}

function requiredItem(
  id: string,
  kind: 'instruction' | 'recent_action',
  content: string,
  action = 'tool_call',
): ContextPlannerCandidate {
  return {
    item: {
      id,
      kind,
      content,
      ...(kind === 'recent_action' ? { action, outcome: 'observed' as const } : {}),
    },
    estimatedTokens: estimateTokens(content),
    required: true,
    priority: Number.MAX_SAFE_INTEGER,
  };
}

function contextToolCandidates(
  state: RunState,
  options: AgentContextPlanningOptions,
): ToolPlannerCandidate[] {
  if (options.tools) {
    for (const candidate of options.tools) {
      if (!state.tools.has(candidate.tool.name)) {
        throw new Error(`Context plan tool "${candidate.tool.name}" is not available to agent "${state.agentName}"`);
      }
    }
    return options.tools;
  }

  return [...state.tools.values()].map((tool) => {
    const inputSchema = isRecord(tool.argsSchema) ? tool.argsSchema : {};
    const modelTool = {
      name: tool.name,
      description: tool.description ?? '',
      inputSchema,
    };
    return {
      tool: modelTool,
      estimatedTokens: estimateTokens(JSON.stringify(modelTool)),
    };
  });
}

function remainingRunBudget(state: RunState, budget: ContextBudget): ContextBudget {
  if (budget.maxToolCalls === undefined) return budget;
  return {
    ...budget,
    maxToolCalls: Math.max(0, budget.maxToolCalls - state.toolCalls.length),
  };
}

function enforceDurationBudget(state: RunState, budget: ContextBudget): void {
  if (budget.maxDurationMs !== undefined && Date.now() - state.startedAt >= budget.maxDurationMs) {
    throw new Error(`Context plan exceeded the run duration budget of ${budget.maxDurationMs}ms`);
  }
}

function enforcePricedCostBudget(target: InferenceTarget, budget: ContextBudget): void {
  if (budget.maxCost === undefined) return;
  const pricing = target.pricing;
  if (
    !pricing
    || pricing.inputPerMillionTokens === undefined
    || pricing.outputPerMillionTokens === undefined
  ) {
    throw new Error(`Inference cost budget cannot be enforced for unpriced target "${target.id}"`);
  }
}

function contextPlanEvent(
  plan: StepContextPlan,
  rejected: InferenceRouteRejection[],
  stepIndex: number,
  policy: { version: string; fingerprint: string; decision: string },
) {
  return {
    type: 'context.plan.selected',
    message: `Selected ${plan.target.id} through ${plan.endpoint.id} for step ${stepIndex}`,
    stepIndex,
    identity: plan.identity,
    policy,
    target: {
      id: plan.target.id,
      provider: plan.target.provider,
      model: plan.target.model,
      capabilities: plan.target.capabilities,
    },
    endpoint: {
      id: plan.endpoint.id,
      provider: plan.endpoint.provider,
      region: plan.endpoint.region,
      trustBoundary: plan.endpoint.trustBoundary,
    },
    budget: plan.budget,
    inputTokenLimit: plan.inputTokenLimit,
    estimatedInputTokens: plan.estimatedInputTokens,
    feasibility: plan.feasibility,
    manifest: plan.manifest,
    model: {
      instructionIds: plan.model.instructions.map((item) => item.id),
      evidenceIds: plan.model.evidence.map((item) => item.id),
      memoryIds: plan.model.memory.map((item) => item.id),
      skills: plan.model.skills.map((skill) => `${skill.name}@${skill.version}`),
      tools: plan.model.tools.map((tool) => tool.name),
      recentActionIds: plan.model.recentActions.map((item) => item.id),
    },
    rejectedRoutes: rejected,
  };
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
