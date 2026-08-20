import { readApproval, redactForGovernance } from '../governance/index.js';
import { createArtifactStore, readJsonArtifact, readJsonArtifacts, writeJsonArtifact } from '../artifact-store/index.js';
import type { ArtifactStore } from '../artifact-store/index.js';
import { createFileSessionStore, type SessionStore } from '../sessions/index.js';
import type { TraceArtifact, TraceEvent } from '../traces/index.js';
import type {
  AgentResumeOptions,
  AgentRunOptions,
  AgentRunResult,
  AgentRunStatus,
  GovernedToolCall,
  GovernedToolSequenceOptions,
  PausedRunArtifact,
} from './interfaces/index.js';
export type {
  AgentResumeOptions,
  AgentRunOptions,
  AgentRunResult,
  AgentRunStatus,
  AgentToolCall,
  GovernedToolCall,
  GovernedToolSequenceOptions,
  PausedRunArtifact,
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
  governanceProfileEvent,
  loadInstructions,
  recordRunEvent,
  resolveProvider,
  resolveRuntimeEdgeMode,
  runProviderLoop,
  type RunState,
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

  const provider = await resolveProvider(options.deployment, agent, options.providerRegistry);
  const maxSteps = options.maxSteps ?? 8;
  const artifactStore = createArtifactStore({
    deployment: options.deployment,
    projectDir: options.projectDir,
    store: options.artifactStore,
  });
  const sessionStore = resolveSessionStore(options.projectDir, options.sessionStore);
  const state: RunState = {
    deployment: options.deployment,
    projectDir: options.projectDir,
    artifactStore,
    sessionStore,
    sessionRevision: 0,
    sessionState: undefined,
    runId: createRunId(),
    agentName: options.agentName,
    agent,
    provider,
    input: options.input,
    instructions: await loadInstructions(options.projectDir, agent.instructions),
    tools: collectAgentTools(options.deployment, agent),
    toolTargets: collectToolTargets(options.deployment),
    policies: collectRunPolicies(options.deployment, options.agentName, agent),
    edgeMode: resolveRuntimeEdgeMode(options.deployment, options),
    toolCalls: [],
    policyViolations: [],
    approvals: [],
    events: [],
    costUsd: 0,
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
  const state: RunState = {
    deployment: options.deployment,
    projectDir: options.projectDir,
    artifactStore,
    sessionStore,
    sessionRevision: 0,
    sessionState: undefined,
    runId: createRunId(),
    agentName: options.agentName,
    agent,
    provider,
    input,
    instructions: '',
    tools: collectAgentTools(options.deployment, agent),
    toolTargets: collectToolTargets(options.deployment),
    policies: collectRunPolicies(options.deployment, options.agentName, agent),
    edgeMode: resolveRuntimeEdgeMode(options.deployment, options),
    toolCalls: [],
    policyViolations: [],
    approvals: [],
    events: [],
    costUsd: 0,
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

  const approval = await readApproval(options.projectDir, paused.pending.approvalId, artifactStore);

  if (!approval) {
    throw new Error(`Approval ${paused.pending.approvalId} for paused run ${paused.runId} was not found`);
  }

  const provider = paused.resumeMode === 'tool_sequence'
    ? exactToolSequenceProvider(paused.provider)
    : await resolveProvider(options.deployment, agent, options.providerRegistry);
  const projection = await sessionStore.getProjection(paused.runId);
  const state: RunState = {
    deployment: options.deployment,
    projectDir: options.projectDir,
    artifactStore,
    sessionStore,
    sessionRevision: projection?.revision ?? paused.sessionRevision ?? 0,
    sessionState: projection?.state,
    runId: paused.runId,
    agentName: paused.agent,
    agent,
    provider,
    input: paused.input,
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
    events: [...(paused.events as TraceEvent[])],
    costUsd: paused.costUsd,
    satisfiedApprovalIds: [],
    lastStepIndex: paused.nextStepIndex,
    resumedFromPause: true,
    resumeMode: paused.resumeMode ?? 'provider',
    remainingCalls: [...(paused.remainingCalls ?? [])],
  };

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
    toolName: paused.pending.toolName,
    nextStepIndex: paused.nextStepIndex,
  }, 'running');
  await appendAudit(state, {
    action: 'agent.run.resumed',
    outcome: 'allowed',
    approvalId: approval.id,
    toolName: paused.pending.toolName,
    message: `Resumed run ${paused.runId} after approval ${approval.id}`,
  });

  return executeRun(state, startedAt, paused.maxSteps, async () => {
    await enforceToolCatalogEdge(state);
    // Execute the approved call exactly as recorded at pause time.
    await callTool(state, paused.pending.toolName, paused.pending.args);

    if (state.resumeMode === 'tool_sequence') {
      await ensureLastToolCallSucceeded(state, paused.pending.toolName);
      await runExactToolCalls(state, paused.remainingCalls ?? [], paused.nextStepIndex + 1);
      return exactToolSequenceAnswer(state);
    }

    // Provider runs continue planning with the full restored history, so
    // already-executed writes are not replayed.
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
    if (!(err instanceof ApprovalRequiredError)) {
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
    toolCalls: state.toolCalls.map((call) => call.name),
    failedToolCalls: state.toolCalls.filter((call) => call.is_error).map((call) => call.name),
    policyViolations: state.policyViolations,
    approvals: state.approvals.map((approval) => ({
      id: approval.id,
      status: approval.status,
      toolName: approval.toolName,
      policy: approval.policy,
    })),
  }, executionStateForStatus(status));
  const result = createAgentRunResult(state, startedAt, state.provider.name, status, finalAnswer);
  await appendAudit(state, {
    action: 'agent.run.completed',
    outcome: status === 'completed' || status === 'completed_with_errors'
      ? 'succeeded'
      : status === 'waiting_approval'
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

  if (!pending) {
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
    input: state.input,
    maxSteps,
    nextStepIndex: state.lastStepIndex,
    costUsd: state.costUsd,
    toolCalls: state.toolCalls,
    events: state.events,
    approvalIds: state.approvals.map((approval) => approval.id),
    pending,
    resumeMode: state.resumeMode,
    remainingCalls: state.resumeMode === 'tool_sequence' ? state.remainingCalls : undefined,
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
    latencyMs,
    costUsd: state.costUsd,
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
    case 'rejected':
      return 'cancelled' as const;
    case 'failed':
      return 'failed' as const;
  }
}
