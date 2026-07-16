import type {
  AgentConfig,
  AgentProvider,
  AnyToolDefinition,
  DeploymentDefinition,
  PolicyDefinition,
} from '@fdekit/core';
import type { ArtifactStore } from '../../artifact-store/index.js';
import type { ApprovalArtifact } from '../../governance/index.js';
import type { TraceEvent } from '../../traces/index.js';
import type { AgentToolCall, PolicyViolation } from '../interfaces/index.js';
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
  runId: string;
  agentName: string;
  agent: AgentConfig;
  provider: AgentProvider;
  input: Record<string, unknown>;
  instructions: string;
  tools: Map<string, AnyToolDefinition>;
  toolTargets: Map<string, Record<string, unknown>>;
  policies: PolicyDefinition[];
  edgeMode: RuntimeEdgeMode;
  toolCalls: AgentToolCall[];
  policyViolations: PolicyViolation[];
  approvals: ApprovalArtifact[];
  events: TraceEvent[];
  costUsd: number;
  approvalOverride?: ApprovalAutoDecision;
  /** Set by policy enforcement when a beforeToolCall approval pauses the run. */
  pendingResume?: PendingResumeCall;
  /** Approval ids satisfied for the tool call currently executing; marked executed on success. */
  satisfiedApprovalIds: string[];
  /** Index of the provider step being processed; persisted so resume continues the loop. */
  lastStepIndex: number;
  /** True when this run was restored from a paused run artifact. */
  resumedFromPause: boolean;
}
