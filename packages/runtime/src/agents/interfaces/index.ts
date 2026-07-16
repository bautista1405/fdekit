import type { DeploymentDefinition, ProviderRuntimeRegistry } from '@fdekit/core';
import type { ArtifactStore } from '../../artifact-store/index.js';
import type { ApprovalArtifact } from '../../governance/index.js';
import type { TraceArtifact } from '../../traces/index.js';

export interface AgentRunOptions {
  deployment: DeploymentDefinition;
  projectDir: string;
  agentName: string;
  input: Record<string, unknown>;
  maxSteps?: number;
  providerRegistry?: ProviderRuntimeRegistry;
  artifactStore?: ArtifactStore;
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
  strict?: boolean;
  requireToolArgsSchema?: boolean;
}

/**
 * Snapshot of a run paused on a pending approval, persisted under
 * `artifacts/runs/<runId>.json`. Resume executes `pending` exactly as recorded
 * (no re-planning) and continues the provider loop from `nextStepIndex`.
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
  pausedAt: string;
  consumedAt?: string;
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
