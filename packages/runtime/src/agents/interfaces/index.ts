import type { DeploymentDefinition, ProviderRuntimeRegistry } from '@fdekit/core';
import type { ArtifactStore } from '../../artifact-store/index.js';
import type { ApprovalArtifact } from '../../governance/index.js';
import type { SessionStore } from '../../sessions/index.js';
import type { TraceArtifact } from '../../traces/index.js';

export interface AgentRunOptions {
  deployment: DeploymentDefinition;
  projectDir: string;
  agentName: string;
  input: Record<string, unknown>;
  maxSteps?: number;
  providerRegistry?: ProviderRuntimeRegistry;
  artifactStore?: ArtifactStore;
  /** Durable append-only run log; defaults to the local file session store. */
  sessionStore?: SessionStore;
  strict?: boolean;
  requireToolArgsSchema?: boolean;
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
  input: Record<string, unknown>;
  maxSteps: number;
  nextStepIndex: number;
  costUsd: number;
  toolCalls: AgentToolCall[];
  events: unknown[];
  approvalIds: string[];
  pending: {
    toolName: string;
    args: Record<string, unknown>;
    approvalId: string;
  };
  /** Absent on legacy artifacts, which resume through the provider loop. */
  resumeMode?: 'provider' | 'tool_sequence';
  /** Exact calls left after `pending`; only used by governed tool sequences. */
  remainingCalls?: GovernedToolCall[];
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

export type AgentRunStatus = 'completed' | 'completed_with_errors' | 'failed' | 'waiting_approval' | 'rejected';

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
  latencyMs: number;
  costUsd: number;
  trace: TraceArtifact;
}
