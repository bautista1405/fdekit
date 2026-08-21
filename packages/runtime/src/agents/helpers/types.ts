import type {
  AgentConfig,
  AgentProvider,
  AnyToolDefinition,
  DeploymentDefinition,
  ExecutionState,
  InputRequestRecord,
  PolicyDefinition,
  ProviderToolResult,
  StepContextPlan,
  UsageMeasurement,
} from '@fdekit/core';
import type { ArtifactStore } from '../../artifact-store/index.js';
import type { ApprovalArtifact } from '../../governance/index.js';
import type { SessionEventInput, SessionStore } from '../../sessions/index.js';
import type { TraceEvent } from '../../traces/index.js';
import type { AgentContextPlanningOptions, AgentRunOptions, AgentToolCall, PolicyViolation } from '../interfaces/index.js';
import type { GovernedToolCall } from '../interfaces/index.js';
import type { RuntimeEdgeMode } from './edge/index.js';

export type ToolPolicyPhase = 'beforeToolCall' | 'afterToolCall';

/** How pending approvals encountered mid-run are decided without a human (eval runs). */
export interface ApprovalAutoDecision {
  decision: 'approved' | 'rejected';
  actor: string;
  reason?: string;
}

/** The exact tool call a paused run will execute on resume, with unredacted args. */
export interface PendingResumeCall {
  toolName: string;
  args: Record<string, unknown>;
  approvalId: string;
}

export interface RunState {
  deployment: DeploymentDefinition;
  projectDir: string;
  artifactStore: ArtifactStore;
  sessionStore: SessionStore;
  sessionRevision: number;
  sessionState?: ExecutionState;
  pendingSessionEvents: SessionEventInput[];
  runId: string;
  taskId: string;
  attemptId: string;
  startedAt: number;
  agentName: string;
  agent: AgentConfig;
  provider: AgentProvider;
  contextPlanning?: AgentContextPlanningOptions;
  activeContextPlan?: StepContextPlan;
  input: Record<string, unknown>;
  inputGate?: AgentRunOptions['inputGate'];
  instructions: string;
  tools: Map<string, AnyToolDefinition>;
  toolTargets: Map<string, Record<string, unknown>>;
  policies: PolicyDefinition[];
  edgeMode: RuntimeEdgeMode;
  toolCalls: AgentToolCall[];
  policyViolations: PolicyViolation[];
  approvals: ApprovalArtifact[];
  approvalReplacements: Record<string, string>;
  inputRequests: InputRequestRecord[];
  inputResumeToken?: string;
  inputAnswers: ProviderToolResult[];
  events: TraceEvent[];
  costUsd: number;
  usage: UsageMeasurement[];
  approvalOverride?: ApprovalAutoDecision;
  /** Set by policy enforcement when a beforeToolCall approval pauses the run. */
  pendingResume?: PendingResumeCall;
  pendingInput?: InputRequestRecord;
  /** Approval ids satisfied for the tool call currently executing; marked executed on success. */
  satisfiedApprovalIds: string[];
  /** Index of the provider step being processed; persisted so resume continues the loop. */
  lastStepIndex: number;
  /** True when this run was restored from a paused run artifact. */
  resumedFromPause: boolean;
  /** Determines whether approval resume returns to provider planning or an exact caller-planned sequence. */
  resumeMode: 'provider' | 'tool_sequence';
  /** Exact calls after the currently executing sequence call, persisted on pause. */
  remainingCalls: GovernedToolCall[];
}
