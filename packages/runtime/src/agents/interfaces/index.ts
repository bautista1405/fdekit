import type {
  ContextBudget,
  ContextObjectives,
  ContextPlannerCandidate,
  DeploymentDefinition,
  EffectivePolicy,
  InferenceRequirements,
  InferenceRouteCandidate,
  InputRequestRecord,
  ActorIdentity,
  ProviderToolResult,
  ProviderRuntimeRegistry,
  SkillPlannerCandidate,
  StepContextPlan,
  ToolPlannerCandidate,
  UsageMeasurement,
} from '@fdekit/core';
import type { ArtifactStore } from '../../artifact-store/index.js';
import type { ApprovalArtifact } from '../../governance/index.js';
import type { SessionStore } from '../../sessions/index.js';
import type { TraceArtifact } from '../../traces/index.js';

export interface AgentRunOptions {
  deployment: DeploymentDefinition;
  projectDir: string;
  agentName: string;
  input: Record<string, unknown>;
  /** Stable task identity used by context plans and traces; defaults to the generated run id. */
  taskId?: string;
  /** Stable attempt identity used by context plans and traces; defaults to the first run attempt. */
  attemptId?: string;
  maxSteps?: number;
  providerRegistry?: ProviderRuntimeRegistry;
  artifactStore?: ArtifactStore;
  /** Durable append-only run log; defaults to the local file session store. */
  sessionStore?: SessionStore;
  strict?: boolean;
  requireToolArgsSchema?: boolean;
  /** Opt in to policy-aware context compilation and inference routing for every provider step. */
  contextPlanning?: AgentContextPlanningOptions;
  /** Optional host-controlled principal, disclosure, deadline, and single-use resume capability. */
  inputGate?: {
    audience?: ActorIdentity[];
    disclosure?: InputRequestRecord['disclosure'];
    deadlineAt?: string;
    requireResumeToken?: boolean;
  };
  /**
   * Decide pending approvals automatically instead of pausing the run.
   * Used by the eval runner; every auto-decision is written to the approval
   * artifact and audit log with the configured actor.
   */
  approvalOverride?: {
    decision: 'approved' | 'rejected';
    actor: string;
    reason?: string;
  };
}

export interface AgentResumeOptions {
  deployment: DeploymentDefinition;
  projectDir: string;
  /** Paused run to resume; when omitted, the latest paused run is used. */
  runId?: string;
  /** Restrict resume to a specific agent's paused runs. */
  agentName?: string;
  providerRegistry?: ProviderRuntimeRegistry;
  artifactStore?: ArtifactStore;
  /** Durable append-only run log; defaults to the local file session store. */
  sessionStore?: SessionStore;
  strict?: boolean;
  requireToolArgsSchema?: boolean;
  /** Required when the paused run used policy-aware context planning. */
  contextPlanning?: AgentContextPlanningOptions;
  /** Required to resume a run paused in needs_input. */
  inputAnswer?: {
    value: unknown;
    answeredBy: ActorIdentity;
    /** Required when the original input gate requested a single-use resume capability. */
    resumeToken?: string;
  };
}

export interface RevisePausedApprovalOptions {
  deployment: DeploymentDefinition;
  projectDir: string;
  approvalId: string;
  args: Record<string, unknown>;
  actor: string;
  reason?: string;
  artifactStore?: ArtifactStore;
  sessionStore?: SessionStore;
}

/**
 * Host-side inputs used to choose an inference route and compile the only
 * context payload eligible for provider serialization.
 */
export interface AgentContextPlanningOptions {
  policy: EffectivePolicy;
  routes: InferenceRouteCandidate[];
  requirements?: InferenceRequirements;
  /** Defaults to the effective policy budget. */
  budget?: ContextBudget;
  objectives: ContextObjectives;
  /** Source identities are authorized before any candidate content is selected. */
  requestedSourceIds?: string[];
  items?: ContextPlannerCandidate[];
  skills?: SkillPlannerCandidate[];
  /** Defaults to candidates derived from the agent's available runtime tools. */
  tools?: ToolPlannerCandidate[];
  /** Opt in to using explicit compressed variants supplied on context candidates. */
  compression?: {
    mode: 'when_needed' | 'prefer';
    minimumSavingsTokens?: number;
  };
}

export interface GovernedToolCall {
  toolName: string;
  args: Record<string, unknown>;
}

/**
 * Execute caller-planned tool calls through the same catalog, policy,
 * approval, audit, trace, and durable-session edges used by agent runs.
 * The runtime never asks a provider to re-plan these calls.
 */
export interface GovernedToolSequenceOptions {
  deployment: DeploymentDefinition;
  projectDir: string;
  agentName: string;
  calls: GovernedToolCall[];
  /** Context exposed to policies and recorded (redacted) with the run. */
  input?: Record<string, unknown>;
  artifactStore?: ArtifactStore;
  /** Durable append-only run log; defaults to the local file session store. */
  sessionStore?: SessionStore;
  strict?: boolean;
  requireToolArgsSchema?: boolean;
  approvalOverride?: AgentRunOptions['approvalOverride'];
}

/**
 * Snapshot of a run paused on a pending approval, persisted under
 * `artifacts/runs/<runId>.json`. Resume executes `pending` exactly as recorded
 * (no re-planning). Provider runs then continue from `nextStepIndex`; exact
 * tool sequences continue with `remainingCalls` and never invoke a provider.
 */
export interface PausedRunArtifact {
  version: 1;
  status: 'paused' | 'consumed';
  runId: string;
  deployment: string;
  environment?: string;
  agent: string;
  provider: string;
  taskId?: string;
  attemptId?: string;
  input: Record<string, unknown>;
  maxSteps: number;
  nextStepIndex: number;
  costUsd: number;
  usage?: UsageMeasurement[];
  toolCalls: AgentToolCall[];
  events: unknown[];
  approvalIds: string[];
  /** Original approval id to latest corrected approval id. */
  approvalReplacements?: Record<string, string>;
  /** Defaults to approval for legacy artifacts. */
  pauseReason?: 'approval' | 'input';
  pending?: {
    toolName: string;
    args: Record<string, unknown>;
    approvalId: string;
  };
  pendingInput?: InputRequestRecord;
  inputRequests?: InputRequestRecord[];
  /** Raw answers required to restore provider history; never copied to traces without redaction. */
  inputAnswers?: ProviderToolResult[];
  /** Absent on legacy artifacts, which resume through the provider loop. */
  resumeMode?: 'provider' | 'tool_sequence';
  /** Exact calls left after `pending`; only used by governed tool sequences. */
  remainingCalls?: GovernedToolCall[];
  /** Exact plan governing the pending call; absent on legacy and exact-sequence artifacts. */
  contextPlan?: StepContextPlan;
  contextPolicyFingerprint?: string;
  /** Resume must be supplied with context-planning inputs when true. */
  contextPlanningRequired?: boolean;
  pausedAt: string;
  consumedAt?: string;
  /** Last durable event revision at pause time; absent on legacy v1 artifacts. */
  sessionRevision?: number;
}

export interface AgentToolCall {
  name: string;
  args: unknown;
  result?: unknown;
  latencyMs: number;
  is_error?: boolean;
  category?: string;
  tags: string[];
  scopes: string[];
  environments: string[];
}

export interface PolicyViolation {
  policy: string;
  phase: 'beforeToolCall' | 'afterToolCall';
  toolName: string;
  reason?: string;
  approvalRequired?: boolean;
  approvalId?: string;
}

export type AgentRunStatus =
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'waiting_approval'
  | 'waiting_input'
  | 'rejected';

export interface AgentRunResult {
  id: string;
  status: AgentRunStatus;
  deployment: string;
  agent: string;
  provider: string;
  input: Record<string, unknown>;
  finalAnswer: string;
  toolCalls: AgentToolCall[];
  policyViolations: PolicyViolation[];
  approvals: ApprovalArtifact[];
  inputRequests: InputRequestRecord[];
  /** Ephemeral capability for the current input request; never persisted to artifacts or traces. */
  inputResumeToken?: string;
  latencyMs: number;
  costUsd: number;
  /** One measured or explicitly unknown record for every provider step. */
  usage: UsageMeasurement[];
  trace: TraceArtifact;
}
