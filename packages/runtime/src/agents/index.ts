import { redactForGovernance } from '../governance/index.js';
import { createArtifactStore } from '../artifact-store/index.js';
import type { TraceArtifact } from '../traces/index.js';
import type { AgentRunOptions, AgentRunResult, AgentRunStatus } from './interfaces/index.js';
export type { AgentRunOptions, AgentRunResult, AgentRunStatus, AgentToolCall, PolicyViolation } from './interfaces/index.js';
import {
  appendAudit,
  ApprovalRequiredError,
  collectAgentTools,
  collectRunPolicies,
  createRunId,
  enforceToolCatalogEdge,
  governanceProfileEvent,
  loadInstructions,
  resolveProvider,
  resolveRuntimeEdgeMode,
  runProviderLoop,
  type RunState,
} from './helpers/index.js';

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
  const id = createRunId();
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
    runId: id,
    agentName: options.agentName,
    agent,
    provider,
    input: options.input,
    instructions: await loadInstructions(options.projectDir, agent.instructions),
    tools: collectAgentTools(options.deployment, agent),
    policies: collectRunPolicies(options.deployment, options.agentName, agent),
    edgeMode: resolveRuntimeEdgeMode(options.deployment, options),
    toolCalls: [],
    policyViolations: [],
    approvals: [],
    events: [],
    costUsd: 0,
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

  let finalAnswer = '';
  let status: AgentRunStatus = 'completed';

  await appendAudit(state, {
    action: 'agent.run.started',
    outcome: 'requested',
    message: `Started agent ${options.agentName}`,
    metadata: { input: options.input, maxSteps },
  });

  try {
    await enforceToolCatalogEdge(state);
    finalAnswer = await runProviderLoop(state, maxSteps);
    status = state.policyViolations.length > 0 ? 'failed' : 'completed';
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
        createAgentRunResult(state, options, startedAt, provider.name, 'failed', message),
      );
    }

    status = 'waiting_approval';
    finalAnswer = err.message;
  }

  const result = createAgentRunResult(state, options, startedAt, provider.name, status, finalAnswer);
  await appendAudit(state, {
    action: 'agent.run.completed',
    outcome: status === 'completed' ? 'succeeded' : status === 'waiting_approval' ? 'requested' : 'failed',
    message: finalAnswer,
    metadata: {
      status,
      latencyMs: result.latencyMs,
      costUsd: state.costUsd,
      toolCalls: state.toolCalls.map((call) => call.name),
      policyViolations: state.policyViolations,
      approvals: state.approvals.map((approval) => approval.id),
    },
  });

  return result;
}

function createAgentRunResult(
  state: RunState,
  options: AgentRunOptions,
  startedAt: number,
  providerName: string,
  status: AgentRunStatus,
  finalAnswer: string,
): AgentRunResult {
  const latencyMs = Date.now() - startedAt;
  const trace: TraceArtifact = {
    id: state.runId,
    createdAt: new Date().toISOString(),
    deployment: options.deployment.name,
    events: [
      ...state.events,
      {
        type: 'agent.run.completed',
        message: finalAnswer,
        status,
        latencyMs,
        costUsd: state.costUsd,
        toolCalls: state.toolCalls.map((call) => call.name),
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
    deployment: options.deployment.name,
    agent: options.agentName,
    provider: providerName,
    input: options.input,
    finalAnswer,
    toolCalls: state.toolCalls,
    policyViolations: state.policyViolations,
    approvals: state.approvals,
    latencyMs,
    costUsd: state.costUsd,
    trace,
  };
}
