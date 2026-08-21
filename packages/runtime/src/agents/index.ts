import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { InputAnswerRecord } from '@fdekit/core';
import {
  readApproval,
  redactForGovernance,
  requestApproval,
  supersedeApproval,
} from '../governance/index.js';
import { createArtifactStore, readJsonArtifact, readJsonArtifacts, writeJsonArtifact } from '../artifact-store/index.js';
import type { ArtifactStore } from '../artifact-store/index.js';
import { createFileSessionStore, type SessionStore } from '../sessions/index.js';
import type { TraceArtifact, TraceEvent } from '../traces/index.js';
import type {
  AgentResumeOptions,
  AgentContextPlanningOptions,
  AgentRunOptions,
  AgentRunResult,
  AgentRunStatus,
  GovernedToolCall,
  GovernedToolSequenceOptions,
  PausedRunArtifact,
  RevisePausedApprovalOptions,
} from './interfaces/index.js';
export type {
  AgentContextPlanningOptions,
  AgentResumeOptions,
  AgentRunOptions,
  AgentRunResult,
  AgentRunStatus,
  AgentToolCall,
  GovernedToolCall,
  GovernedToolSequenceOptions,
  PausedRunArtifact,
  RevisePausedApprovalOptions,
  PolicyViolation,
} from './interfaces/index.js';
import {
  appendAudit,
  ApprovalRequiredError,
  callTool,
  collectAgentTools,
  collectRunPolicies,
  collectToolTargets,
  createRunId,
  enforceToolCatalogEdge,
  enforceContextPlannedTool,
  governanceProfileEvent,
  InputRequiredError,
  loadInstructions,
  recordRunEvent,
  selectContextInferenceRoute,
  resolveProvider,
  resolveRuntimeEdgeMode,
  runProviderLoop,
  type RunState,
  validateJsonSchema,
  validateToolArgsSchema,
} from './helpers/index.js';

const PAUSED_RUNS_GROUP = 'runs';

export class AgentRunError extends Error {
  readonly result: AgentRunResult;

  constructor(message: string, result: AgentRunResult) {
    super(message);
    this.name = 'AgentRunError';
    this.result = result;
  }
}

export async function runAgent(options: AgentRunOptions): Promise<AgentRunResult> {
  const startedAt = Date.now();
  const agent = options.deployment.agents[options.agentName];

  if (!agent) {
    throw new Error(`Agent "${options.agentName}" is not defined in deployment "${options.deployment.name}"`);
  }

  const route = options.contextPlanning
    ? selectContextInferenceRoute(options.contextPlanning)
    : undefined;
  const provider = await resolveProvider(options.deployment, agent, options.providerRegistry, route);
  const maxSteps = options.maxSteps ?? 8;
  const artifactStore = createArtifactStore({
    deployment: options.deployment,
    projectDir: options.projectDir,
    store: options.artifactStore,
  });
  const sessionStore = resolveSessionStore(options.projectDir, options.sessionStore);
  const runId = createRunId();
  const state: RunState = {
    deployment: options.deployment,
    projectDir: options.projectDir,
    artifactStore,
    sessionStore,
    sessionRevision: 0,
    sessionState: undefined,
    pendingSessionEvents: [],
    runId,
    taskId: options.taskId ?? runId,
    attemptId: options.attemptId ?? `${runId}:attempt:1`,
    startedAt,
    agentName: options.agentName,
    agent,
    provider,
    contextPlanning: options.contextPlanning,
    input: options.input,
    inputGate: options.inputGate,
    instructions: await loadInstructions(options.projectDir, agent.instructions),
    tools: collectAgentTools(options.deployment, agent),
    toolTargets: collectToolTargets(options.deployment),
    policies: collectRunPolicies(options.deployment, options.agentName, agent),
    edgeMode: resolveRuntimeEdgeMode(options.deployment, options),
    toolCalls: [],
    policyViolations: [],
    approvals: [],
    approvalReplacements: {},
    inputRequests: [],
    inputResumeToken: undefined,
    inputAnswers: [],
    events: [],
    costUsd: 0,
    usage: [],
    approvalOverride: options.approvalOverride,
    satisfiedApprovalIds: [],
    lastStepIndex: 0,
    resumedFromPause: false,
    resumeMode: 'provider',
    remainingCalls: [],
  };

  await recordRunEvent(state, {
    type: 'agent.run.started',
    message: `Started agent ${options.agentName}`,
    agent: options.agentName,
    provider: provider.name,
    input: redactForGovernance(options.input),
    maxSteps,
    instructionsPath: agent.instructions,
    instructionsLength: state.instructions.length,
  }, 'queued');
  await recordRunEvent(state, {
    type: 'governance.profile',
    ...governanceProfileEvent(options.deployment, options.agentName, agent, state.policies),
  }, 'planning');

  await appendAudit(state, {
    action: 'agent.run.started',
    outcome: 'requested',
    message: `Started agent ${options.agentName}`,
    metadata: { input: options.input, maxSteps },
  });

  return executeRun(state, startedAt, maxSteps, async () => {
    await enforceToolCatalogEdge(state);
    return runProviderLoop(state, maxSteps);
  });
}

/**
 * Runs an exact caller-planned sequence without provider re-planning while
 * preserving the runtime's normal governance, approval, audit, and replay
 * guarantees. A sequence that pauses can be continued with `resumeAgentRun`.
 */
export async function executeGovernedToolSequence(
  options: GovernedToolSequenceOptions,
): Promise<AgentRunResult> {
  if (options.calls.length === 0) {
    throw new Error('A governed tool sequence requires at least one call');
  }

  const startedAt = Date.now();
  const agent = options.deployment.agents[options.agentName];

  if (!agent) {
    throw new Error(`Agent "${options.agentName}" is not defined in deployment "${options.deployment.name}"`);
  }

  const provider = exactToolSequenceProvider(agent.provider);
  const artifactStore = createArtifactStore({
    deployment: options.deployment,
    projectDir: options.projectDir,
    store: options.artifactStore,
  });
  const sessionStore = resolveSessionStore(options.projectDir, options.sessionStore);
  const input = options.input ?? {};
  const runId = createRunId();
  const state: RunState = {
    deployment: options.deployment,
    projectDir: options.projectDir,
    artifactStore,
    sessionStore,
    sessionRevision: 0,
    sessionState: undefined,
    pendingSessionEvents: [],
    runId,
    taskId: runId,
    attemptId: `${runId}:attempt:1`,
    startedAt,
    agentName: options.agentName,
    agent,
    provider,
    input,
    inputGate: undefined,
    instructions: '',
    tools: collectAgentTools(options.deployment, agent),
    toolTargets: collectToolTargets(options.deployment),
    policies: collectRunPolicies(options.deployment, options.agentName, agent),
    edgeMode: resolveRuntimeEdgeMode(options.deployment, options),
    toolCalls: [],
    policyViolations: [],
    approvals: [],
    approvalReplacements: {},
    inputRequests: [],
    inputResumeToken: undefined,
    inputAnswers: [],
    events: [],
    costUsd: 0,
    usage: [],
    approvalOverride: options.approvalOverride,
    satisfiedApprovalIds: [],
    lastStepIndex: 0,
    resumedFromPause: false,
    resumeMode: 'tool_sequence',
    remainingCalls: [],
  };
  await recordRunEvent(state, {
    type: 'agent.run.started',
    message: `Started governed tool sequence for ${options.agentName}`,
    agent: options.agentName,
    provider: provider.name,
    input: redactForGovernance(input),
    maxSteps: options.calls.length,
    executionMode: 'tool_sequence',
    plannedTools: options.calls.map((call) => call.toolName),
  }, 'queued');
  await recordRunEvent(state, {
    type: 'governance.profile',
    ...governanceProfileEvent(options.deployment, options.agentName, agent, state.policies),
  }, 'planning');
  await appendAudit(state, {
    action: 'agent.run.started',
    outcome: 'requested',
    message: `Started governed tool sequence for ${options.agentName}`,
    metadata: { input, plannedTools: options.calls.map((call) => call.toolName) },
  });

  return executeRun(state, startedAt, options.calls.length, async () => {
    await enforceToolCatalogEdge(state);
    await runExactToolCalls(state, options.calls, 0);
    return exactToolSequenceAnswer(state);
  });
}

/**
 * Resumes a run paused on an approval: executes the exact tool call recorded
 * at pause time (so provider nondeterminism cannot drift approved args), then
 * continues either the restored provider history or the persisted exact tool
 * sequence without replaying already-completed writes.
 */
export async function resumeAgentRun(options: AgentResumeOptions): Promise<AgentRunResult> {
  const startedAt = Date.now();
  const artifactStore = createArtifactStore({
    deployment: options.deployment,
    projectDir: options.projectDir,
    store: options.artifactStore,
  });
  const sessionStore = resolveSessionStore(options.projectDir, options.sessionStore);
  const paused = await findPausedRun(options, artifactStore);
  const agent = options.deployment.agents[paused.agent];

  if (!agent) {
    throw new Error(`Agent "${paused.agent}" from paused run ${paused.runId} is not defined in deployment "${options.deployment.name}"`);
  }

  if (paused.contextPlanningRequired && !options.contextPlanning) {
    throw new Error(`Paused run ${paused.runId} requires contextPlanning options to resume safely`);
  }
  const route = options.contextPlanning
    ? selectContextInferenceRoute(options.contextPlanning)
    : undefined;
  if (paused.contextPlan && route && (
    paused.contextPlan.endpoint.id !== route.endpointId
    || paused.contextPlan.target.id !== route.target.id
    || paused.contextPlan.target.model !== route.model
  )) {
    throw new Error(
      `Paused run ${paused.runId} must resume through target ${paused.contextPlan.target.id} `
      + `and endpoint ${paused.contextPlan.endpoint.id}`,
    );
  }
  if (
    paused.contextPolicyFingerprint
    && options.contextPlanning
    && paused.contextPolicyFingerprint !== options.contextPlanning.policy.fingerprint
  ) {
    throw new Error(`Paused run ${paused.runId} must resume under the same effective policy`);
  }
  const provider = paused.resumeMode === 'tool_sequence'
    ? exactToolSequenceProvider(paused.provider)
    : await resolveProvider(options.deployment, agent, options.providerRegistry, route);
  const projection = await sessionStore.getProjection(paused.runId);
  const state: RunState = {
    deployment: options.deployment,
    projectDir: options.projectDir,
    artifactStore,
    sessionStore,
    sessionRevision: projection?.revision ?? paused.sessionRevision ?? 0,
    sessionState: projection?.state,
    pendingSessionEvents: [],
    runId: paused.runId,
    taskId: paused.taskId ?? paused.runId,
    attemptId: paused.attemptId ?? `${paused.runId}:attempt:1`,
    startedAt,
    agentName: paused.agent,
    agent,
    provider,
    contextPlanning: options.contextPlanning,
    activeContextPlan: paused.contextPlan,
    input: paused.input,
    inputGate: undefined,
    instructions: paused.resumeMode === 'tool_sequence'
      ? ''
      : await loadInstructions(options.projectDir, agent.instructions),
    tools: collectAgentTools(options.deployment, agent),
    toolTargets: collectToolTargets(options.deployment),
    policies: collectRunPolicies(options.deployment, paused.agent, agent),
    edgeMode: resolveRuntimeEdgeMode(options.deployment, options),
    toolCalls: [...paused.toolCalls],
    policyViolations: [],
    approvals: [],
    approvalReplacements: { ...(paused.approvalReplacements ?? {}) },
    inputRequests: [...(paused.inputRequests ?? (paused.pendingInput ? [paused.pendingInput] : []))],
    inputResumeToken: undefined,
    inputAnswers: [...(paused.inputAnswers ?? [])],
    events: [...(paused.events as TraceEvent[])],
    costUsd: paused.costUsd,
    usage: [...(paused.usage ?? [])],
    satisfiedApprovalIds: [],
    lastStepIndex: paused.nextStepIndex,
    resumedFromPause: true,
    resumeMode: paused.resumeMode ?? 'provider',
    remainingCalls: [...(paused.remainingCalls ?? [])],
  };

  if ((paused.pauseReason ?? 'approval') === 'input') {
    return resumeInputRun(state, paused, options, startedAt);
  }

  if (!paused.pending) {
    throw new Error(`Paused approval run ${paused.runId} is missing its exact pending call`);
  }
  const pending = paused.pending;
  const approval = await readApproval(options.projectDir, pending.approvalId, artifactStore);
  if (!approval) {
    throw new Error(`Approval ${paused.pending.approvalId} for paused run ${paused.runId} was not found`);
  }

  for (const approvalId of paused.approvalIds) {
    const restored = approvalId === approval.id
      ? approval
      : await readApproval(options.projectDir, approvalId, artifactStore);

    if (restored) {
      state.approvals.push(restored);
    }
  }

  if (approval.status !== 'approved') {
    const finalAnswer = approval.status === 'rejected'
      ? `Approval required for ${approval.toolName}; request ${approval.id} is rejected`
      : `Approval required for ${approval.toolName}; request ${approval.id} is pending`;
    const status: AgentRunStatus = approval.status === 'rejected' ? 'rejected' : 'waiting_approval';
    await recordRunEvent(state, {
      type: 'agent.run.resume_blocked',
      message: finalAnswer,
      approvalId: approval.id,
      approvalStatus: approval.status,
      toolName: approval.toolName,
    }, status === 'rejected' ? 'cancelled' : 'needs_approval');
    const result = createAgentRunResult(state, startedAt, provider.name, status, finalAnswer);

    await appendAudit(state, {
      action: 'agent.run.resume_blocked',
      outcome: approval.status === 'rejected' ? 'rejected' : 'requested',
      approvalId: approval.id,
      toolName: approval.toolName,
      message: finalAnswer,
    });

    return result;
  }

  await recordRunEvent(state, {
    type: 'agent.run.resumed',
    message: `Resumed run ${paused.runId} after approval ${approval.id}`,
    agent: paused.agent,
    provider: provider.name,
    approvalId: approval.id,
    toolName: pending.toolName,
    nextStepIndex: paused.nextStepIndex,
  }, 'running');
  await appendAudit(state, {
    action: 'agent.run.resumed',
    outcome: 'allowed',
    approvalId: approval.id,
    toolName: pending.toolName,
    message: `Resumed run ${paused.runId} after approval ${approval.id}`,
  });

  return executeRun(state, startedAt, paused.maxSteps, async () => {
    await enforceToolCatalogEdge(state);
    // Execute the approved call exactly as recorded at pause time.
    await enforceContextPlannedTool(state, pending.toolName, paused.nextStepIndex);
    await callTool(state, pending.toolName, pending.args);

    if (state.resumeMode === 'tool_sequence') {
      await ensureLastToolCallSucceeded(state, pending.toolName);
      await runExactToolCalls(state, paused.remainingCalls ?? [], paused.nextStepIndex + 1);
      return exactToolSequenceAnswer(state);
    }

    // Provider runs continue planning with the full restored history, so
    // already-executed writes are not replayed.
    return runProviderLoop(state, paused.maxSteps, paused.nextStepIndex + 1);
  });
}

/** Replace a pending tool call with schema-valid args and a fresh approval subject. */
export async function revisePausedApproval(
  options: RevisePausedApprovalOptions,
): Promise<{ previous: Awaited<ReturnType<typeof supersedeApproval>>; current: NonNullable<Awaited<ReturnType<typeof readApproval>>>; runId: string }> {
  const artifactStore = createArtifactStore({
    deployment: options.deployment,
    projectDir: options.projectDir,
    store: options.artifactStore,
  });
  const pausedRuns = await readJsonArtifacts<PausedRunArtifact>(
    options.projectDir,
    PAUSED_RUNS_GROUP,
    artifactStore,
  );
  const paused = pausedRuns.find((candidate) => (
    candidate.status === 'paused'
    && candidate.pauseReason !== 'input'
    && candidate.pending?.approvalId === options.approvalId
  ));
  if (!paused?.pending) {
    throw new Error(`No paused run has pending approval ${options.approvalId}`);
  }
  const approval = await readApproval(options.projectDir, options.approvalId, artifactStore);
  if (!approval) throw new Error(`Approval request not found: ${options.approvalId}`);
  if (approval.status !== 'pending') {
    throw new Error(`Only a pending approval can be revised; ${approval.id} is ${approval.status}`);
  }
  const agent = options.deployment.agents[paused.agent];
  if (!agent) throw new Error(`Agent "${paused.agent}" is not defined`);
  const tool = collectAgentTools(options.deployment, agent).get(paused.pending.toolName);
  if (!tool) throw new Error(`Tool "${paused.pending.toolName}" is not available to agent "${paused.agent}"`);
  if (!tool.argsSchema) {
    throw new Error(`Tool "${tool.name}" requires argsSchema before pending args can be corrected`);
  }
  const issues = validateToolArgsSchema(tool.argsSchema, options.args);
  if (issues.length > 0) {
    throw new Error(`Replacement args ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
  }

  const current = await requestApproval(options.projectDir, {
    deployment: approval.deployment,
    environment: approval.environment,
    agent: approval.agent,
    runId: approval.runId,
    traceId: approval.traceId,
    policy: approval.policy,
    phase: approval.phase,
    toolName: approval.toolName,
    args: options.args,
    target: approval.target,
    reason: options.reason ?? approval.reason,
    requestedBy: options.actor,
    supersedesId: approval.id,
  }, artifactStore);
  const rootId = Object.entries(paused.approvalReplacements ?? {})
    .find(([, replacementId]) => replacementId === approval.id)?.[0] ?? approval.id;
  const nextPaused: PausedRunArtifact = {
    ...paused,
    pending: { ...paused.pending, args: options.args, approvalId: current.id },
    approvalIds: [...new Set([...paused.approvalIds, current.id])],
    approvalReplacements: {
      ...(paused.approvalReplacements ?? {}),
      [rootId]: current.id,
    },
    pausedAt: new Date().toISOString(),
  };
  await writeJsonArtifact(
    options.projectDir,
    PAUSED_RUNS_GROUP,
    `${paused.runId}.json`,
    nextPaused,
    artifactStore,
  );

  const sessionStore = resolveSessionStore(options.projectDir, options.sessionStore);
  const projection = await sessionStore.getProjection(paused.runId);
  if (projection) {
    const eventId = randomUUID();
    await sessionStore.append(paused.runId, {
      eventId,
      idempotencyKey: eventId,
      type: 'approval.revised',
      occurredAt: new Date().toISOString(),
      state: projection.state,
      actor: { id: options.actor, kind: 'user' },
      payload: {
        previousApprovalId: approval.id,
        approvalId: current.id,
        toolName: approval.toolName,
        args: redactForGovernance(options.args),
        reason: options.reason,
      },
    }, { expectedRevision: projection.revision });
  }
  const previous = await supersedeApproval(
    options.projectDir,
    approval.id,
    current.id,
    { actor: options.actor, reason: options.reason },
    artifactStore,
  );
  return { previous, current, runId: paused.runId };
}

async function resumeInputRun(
  state: RunState,
  paused: PausedRunArtifact,
  options: AgentResumeOptions,
  startedAt: number,
): Promise<AgentRunResult> {
  const request = paused.pendingInput;
  if (!request) {
    throw new Error(`Paused input run ${paused.runId} is missing its pending input request`);
  }

  if (!options.inputAnswer) {
    const message = `Input required: ${request.prompt}`;
    await recordRunEvent(state, {
      type: 'agent.run.resume_blocked',
      message,
      requestId: request.requestId,
      prompt: request.prompt,
    }, 'needs_input');
    await appendAudit(state, {
      action: 'agent.run.resume_blocked',
      outcome: 'requested',
      message,
      metadata: { requestId: request.requestId },
    });
    return createAgentRunResult(
      state,
      startedAt,
      state.provider.name,
      'waiting_input',
      message,
    );
  }
  const inputAnswer = options.inputAnswer;

  if (request.deadlineAt && Date.now() >= Date.parse(request.deadlineAt)) {
    throw new Error(`Input request ${request.requestId} expired at ${request.deadlineAt}`);
  }
  if (request.audience?.length && !request.audience.some((actor) => (
    actor.id === inputAnswer.answeredBy.id
    && actor.kind === inputAnswer.answeredBy.kind
  ))) {
    throw new Error(`Actor ${inputAnswer.answeredBy.id} is not an intended principal for input request ${request.requestId}`);
  }
  if (request.resumeTokenDigest) {
    const received = inputAnswer.resumeToken
      ? `sha256:${createHash('sha256').update(inputAnswer.resumeToken).digest('hex')}`
      : '';
    const expectedBuffer = Buffer.from(request.resumeTokenDigest);
    const receivedBuffer = Buffer.from(received);
    if (
      expectedBuffer.byteLength !== receivedBuffer.byteLength
      || !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new Error(`Input request ${request.requestId} requires its valid resume token`);
    }
  }

  const issues = validateJsonSchema(request.inputSchema, inputAnswer.value);
  if (issues.length > 0) {
    throw new Error(`Input answer ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
  }

  const answer: InputAnswerRecord = {
    schemaVersion: 1,
    requestId: request.requestId,
    answerId: randomUUID(),
    value: inputAnswer.value,
    answeredAt: new Date().toISOString(),
    answeredBy: inputAnswer.answeredBy,
  };
  state.inputRequests = state.inputRequests.map((candidate) => candidate.requestId === request.requestId
    ? { ...candidate, status: 'answered' }
    : candidate);
  state.inputAnswers.push({
    name: 'fdekit.input',
    args: { requestId: request.requestId, prompt: request.prompt },
    result: answer.value,
    latencyMs: 0,
  });
  state.pendingInput = undefined;

  await recordRunEvent(state, {
    type: 'input.answered',
    requestId: answer.requestId,
    answerId: answer.answerId,
    answeredBy: answer.answeredBy.id,
    value: redactForGovernance(answer.value),
  }, 'running');
  await appendAudit(state, {
    action: 'input.answered',
    outcome: 'allowed',
    message: `Answered input request ${answer.requestId}`,
    metadata: {
      requestId: answer.requestId,
      answerId: answer.answerId,
      answeredBy: answer.answeredBy.id,
      value: redactForGovernance(answer.value),
    },
  });
  // Consume the human-response capability before any further provider/tool
  // work. A later input request will create a new paused artifact and token.
  await consumePausedRun(state);

  return executeRun(state, startedAt, paused.maxSteps, async () => {
    await enforceToolCatalogEdge(state);
    return runProviderLoop(state, paused.maxSteps, paused.nextStepIndex + 1);
  });
}

async function executeRun(
  state: RunState,
  startedAt: number,
  maxSteps: number,
  run: () => Promise<string>,
): Promise<AgentRunResult> {
  let finalAnswer = '';
  let status: AgentRunStatus = 'completed';
  let failure: string | undefined;

  try {
    finalAnswer = await run();
    status = resolveTerminalStatus(state);
    await consumePausedRun(state);
  } catch (err) {
    if (err instanceof InputRequiredError) {
      status = 'waiting_input';
      finalAnswer = err.message;
      await writePausedRun(state, maxSteps);
    } else if (!(err instanceof ApprovalRequiredError)) {
      const message = err instanceof Error ? err.message : String(err);
      await appendAudit(state, {
        action: 'agent.run.failed',
        outcome: 'failed',
        message,
        metadata: {
          toolCalls: state.toolCalls.map((call) => call.name),
          policyViolations: state.policyViolations,
        },
      });
      status = 'failed';
      finalAnswer = message;
      failure = message;
    } else {
      status = err.approval.status === 'rejected' ? 'rejected' : 'waiting_approval';
      finalAnswer = err.message;

      if (status === 'waiting_approval' && state.pendingResume) {
        await writePausedRun(state, maxSteps);
      }
    }
  }

  const latencyMs = Date.now() - startedAt;
  await recordRunEvent(state, {
    type: 'agent.run.completed',
    message: finalAnswer,
    status,
    latencyMs,
    costUsd: state.costUsd,
    usage: state.usage,
    toolCalls: state.toolCalls.map((call) => call.name),
    failedToolCalls: state.toolCalls.filter((call) => call.is_error).map((call) => call.name),
    policyViolations: state.policyViolations,
    approvals: state.approvals.map((approval) => ({
      id: approval.id,
      status: approval.status,
      toolName: approval.toolName,
      policy: approval.policy,
    })),
    inputRequests: state.inputRequests.map((request) => ({
      requestId: request.requestId,
      status: request.status,
      prompt: request.prompt,
      disclosure: request.disclosure,
    })),
  }, executionStateForStatus(status));
  const result = createAgentRunResult(state, startedAt, state.provider.name, status, finalAnswer);
  await appendAudit(state, {
    action: 'agent.run.completed',
    outcome: status === 'completed' || status === 'completed_with_errors'
      ? 'succeeded'
      : status === 'waiting_approval'
        || status === 'waiting_input'
        ? 'requested'
        : status === 'rejected'
          ? 'rejected'
          : 'failed',
    message: finalAnswer,
    metadata: {
      status,
      latencyMs: result.latencyMs,
      costUsd: state.costUsd,
      toolCalls: state.toolCalls.map((call) => call.name),
      failedToolCalls: state.toolCalls.filter((call) => call.is_error).map((call) => call.name),
      policyViolations: state.policyViolations,
      approvals: state.approvals.map((approval) => approval.id),
    },
  });

  if (failure) {
    throw new AgentRunError(failure, result);
  }

  return result;
}

function resolveTerminalStatus(state: RunState): AgentRunStatus {
  if (state.policyViolations.length > 0) {
    return 'failed';
  }

  return state.toolCalls.some((call) => call.is_error) ? 'completed_with_errors' : 'completed';
}

async function writePausedRun(state: RunState, maxSteps: number): Promise<void> {
  const pending = state.pendingResume;
  const pendingInput = state.pendingInput;

  if (!pending && !pendingInput) {
    return;
  }

  const paused: PausedRunArtifact = {
    version: 1,
    status: 'paused',
    runId: state.runId,
    deployment: state.deployment.name,
    environment: state.deployment.environment,
    agent: state.agentName,
    provider: state.provider.name,
    taskId: state.taskId,
    attemptId: state.attemptId,
    input: state.input,
    maxSteps,
    nextStepIndex: state.lastStepIndex,
    costUsd: state.costUsd,
    usage: state.usage,
    toolCalls: state.toolCalls,
    events: state.events,
    approvalIds: state.approvals.map((approval) => approval.id),
    approvalReplacements: state.approvalReplacements,
    pauseReason: pendingInput ? 'input' : 'approval',
    ...(pending ? { pending } : {}),
    ...(pendingInput ? { pendingInput } : {}),
    inputRequests: state.inputRequests,
    inputAnswers: state.inputAnswers,
    resumeMode: state.resumeMode,
    remainingCalls: state.resumeMode === 'tool_sequence' ? state.remainingCalls : undefined,
    contextPlan: state.resumeMode === 'provider' ? state.activeContextPlan : undefined,
    contextPolicyFingerprint: state.resumeMode === 'provider'
      ? state.contextPlanning?.policy.fingerprint
      : undefined,
    contextPlanningRequired: state.resumeMode === 'provider' && Boolean(state.contextPlanning),
    pausedAt: new Date().toISOString(),
    sessionRevision: state.sessionRevision,
  };

  await writeJsonArtifact(state.projectDir, PAUSED_RUNS_GROUP, `${state.runId}.json`, paused, state.artifactStore);
}

async function runExactToolCalls(
  state: RunState,
  calls: GovernedToolCall[],
  startStepIndex: number,
): Promise<void> {
  for (const [offset, call] of calls.entries()) {
    state.lastStepIndex = startStepIndex + offset;
    state.remainingCalls = calls.slice(offset + 1);
    state.pendingResume = undefined;
    await callTool(state, call.toolName, call.args);
    await ensureLastToolCallSucceeded(state, call.toolName);
  }

  state.remainingCalls = [];
}

async function ensureLastToolCallSucceeded(state: RunState, toolName: string): Promise<void> {
  if (state.toolCalls.at(-1)?.is_error) {
    throw new Error(`Governed tool call "${toolName}" failed`);
  }
}

function exactToolSequenceAnswer(state: RunState): string {
  return JSON.stringify({
    mode: 'tool_sequence',
    calls: state.toolCalls.map((call) => ({
      name: call.name,
      result: call.result,
    })),
  });
}

function exactToolSequenceProvider(name = 'deterministic'): RunState['provider'] {
  return {
    name,
    planNextStep() {
      throw new Error('Governed exact tool sequences do not invoke provider planning');
    },
  };
}

async function consumePausedRun(state: RunState): Promise<void> {
  if (!state.resumedFromPause) {
    return;
  }

  const paused = await readJsonArtifact<PausedRunArtifact>(
    state.projectDir,
    PAUSED_RUNS_GROUP,
    `${state.runId}.json`,
    state.artifactStore,
  );

  if (!paused || paused.status !== 'paused') {
    return;
  }

  await writeJsonArtifact(state.projectDir, PAUSED_RUNS_GROUP, `${state.runId}.json`, {
    ...paused,
    status: 'consumed',
    consumedAt: new Date().toISOString(),
  }, state.artifactStore);
}

async function findPausedRun(
  options: AgentResumeOptions,
  artifactStore: ArtifactStore,
): Promise<PausedRunArtifact> {
  if (options.runId) {
    const paused = await readJsonArtifact<PausedRunArtifact>(
      options.projectDir,
      PAUSED_RUNS_GROUP,
      `${options.runId}.json`,
      artifactStore,
    );

    if (!paused) {
      throw new Error(`No paused run found for ${options.runId}`);
    }

    if (paused.status !== 'paused') {
      throw new Error(`Run ${options.runId} was already resumed to completion; start a new run instead`);
    }

    return paused;
  }

  const candidates = (await readJsonArtifacts<PausedRunArtifact>(options.projectDir, PAUSED_RUNS_GROUP, artifactStore))
    .filter((candidate) => candidate.version === 1 && candidate.status === 'paused')
    .filter((candidate) => !options.agentName || candidate.agent === options.agentName)
    .sort((left, right) => left.pausedAt.localeCompare(right.pausedAt));
  const latest = candidates.at(-1);

  if (!latest) {
    throw new Error(options.agentName
      ? `No paused runs found for agent "${options.agentName}"`
      : 'No paused runs found');
  }

  return latest;
}

function createAgentRunResult(
  state: RunState,
  startedAt: number,
  providerName: string,
  status: AgentRunStatus,
  finalAnswer: string,
): AgentRunResult {
  const latencyMs = Date.now() - startedAt;
  const trace: TraceArtifact = {
    id: state.runId,
    createdAt: new Date().toISOString(),
    deployment: state.deployment.name,
    events: state.events,
  };

  return {
    id: state.runId,
    status,
    deployment: state.deployment.name,
    agent: state.agentName,
    provider: providerName,
    input: state.input,
    finalAnswer,
    toolCalls: state.toolCalls,
    policyViolations: state.policyViolations,
    approvals: state.approvals,
    inputRequests: state.inputRequests,
    ...(state.inputResumeToken ? { inputResumeToken: state.inputResumeToken } : {}),
    latencyMs,
    costUsd: state.costUsd,
    usage: state.usage,
    trace,
  };
}

function resolveSessionStore(projectDir: string, store: SessionStore | undefined): SessionStore {
  return store ?? createFileSessionStore({ projectDir });
}

function executionStateForStatus(status: AgentRunStatus) {
  switch (status) {
    case 'completed':
      return 'completed' as const;
    case 'completed_with_errors':
      return 'completed_with_limits' as const;
    case 'waiting_approval':
      return 'needs_approval' as const;
    case 'waiting_input':
      return 'needs_input' as const;
    case 'rejected':
      return 'cancelled' as const;
    case 'failed':
      return 'failed' as const;
  }
}
