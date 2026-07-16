import { readApproval, redactForGovernance } from '../governance/index.js';
import { createArtifactStore, readJsonArtifact, readJsonArtifacts, writeJsonArtifact } from '../artifact-store/index.js';
import type { ArtifactStore } from '../artifact-store/index.js';
import type { TraceArtifact, TraceEvent } from '../traces/index.js';
import type {
  AgentResumeOptions,
  AgentRunOptions,
  AgentRunResult,
  AgentRunStatus,
  PausedRunArtifact,
} from './interfaces/index.js';
export type {
  AgentResumeOptions,
  AgentRunOptions,
  AgentRunResult,
  AgentRunStatus,
  AgentToolCall,
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
  const state: RunState = {
    deployment: options.deployment,
    projectDir: options.projectDir,
    artifactStore,
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
  };

  state.events.push({
    type: 'agent.run.started',
    message: `Started agent ${options.agentName}`,
    agent: options.agentName,
    provider: provider.name,
    input: redactForGovernance(options.input),
    maxSteps,
    instructionsPath: agent.instructions,
    instructionsLength: state.instructions.length,
  });
  state.events.push({
    type: 'governance.profile',
    ...governanceProfileEvent(options.deployment, options.agentName, agent, state.policies),
  });

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
 * Resumes a run paused on an approval: executes the exact tool call recorded
 * at pause time (no re-planning, so provider nondeterminism cannot drift the
 * approved args) and continues the provider loop with the restored history,
 * so already-executed writes are not replayed.
 */
export async function resumeAgentRun(options: AgentResumeOptions): Promise<AgentRunResult> {
  const startedAt = Date.now();
  const artifactStore = createArtifactStore({
    deployment: options.deployment,
    projectDir: options.projectDir,
    store: options.artifactStore,
  });
  const paused = await findPausedRun(options, artifactStore);
  const agent = options.deployment.agents[paused.agent];

  if (!agent) {
    throw new Error(`Agent "${paused.agent}" from paused run ${paused.runId} is not defined in deployment "${options.deployment.name}"`);
  }

  const approval = await readApproval(options.projectDir, paused.pending.approvalId, artifactStore);

  if (!approval) {
    throw new Error(`Approval ${paused.pending.approvalId} for paused run ${paused.runId} was not found`);
  }

  const provider = await resolveProvider(options.deployment, agent, options.providerRegistry);
  const state: RunState = {
    deployment: options.deployment,
    projectDir: options.projectDir,
    artifactStore,
    runId: paused.runId,
    agentName: paused.agent,
    agent,
    provider,
    input: paused.input,
    instructions: await loadInstructions(options.projectDir, agent.instructions),
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

  state.events.push({
    type: 'agent.run.resumed',
    message: `Resumed run ${paused.runId} after approval ${approval.id}`,
    agent: paused.agent,
    provider: provider.name,
    approvalId: approval.id,
    toolName: paused.pending.toolName,
    nextStepIndex: paused.nextStepIndex,
  });
  await appendAudit(state, {
    action: 'agent.run.resumed',
    outcome: 'allowed',
    approvalId: approval.id,
    toolName: paused.pending.toolName,
    message: `Resumed run ${paused.runId} after approval ${approval.id}`,
  });

  return executeRun(state, startedAt, paused.maxSteps, async () => {
    await enforceToolCatalogEdge(state);
    // Execute the approved call exactly as recorded at pause time, then let
    // the provider continue planning with the full restored history.
    await callTool(state, paused.pending.toolName, paused.pending.args);
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
      throw new AgentRunError(
        message,
        createAgentRunResult(state, startedAt, state.provider.name, 'failed', message),
      );
    }

    status = err.approval.status === 'rejected' ? 'rejected' : 'waiting_approval';
    finalAnswer = err.message;

    if (status === 'waiting_approval' && state.pendingResume) {
      await writePausedRun(state, maxSteps);
    }
  }

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
    pausedAt: new Date().toISOString(),
  };

  await writeJsonArtifact(state.projectDir, PAUSED_RUNS_GROUP, `${state.runId}.json`, paused, state.artifactStore);
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
    events: [
      ...state.events,
      {
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
      },
    ],
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
