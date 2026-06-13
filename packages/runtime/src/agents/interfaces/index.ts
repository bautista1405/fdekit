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
}

export interface AgentToolCall {
  name: string;
  args: unknown;
  result?: unknown;
  latencyMs: number;
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

export type AgentRunStatus = 'completed' | 'failed' | 'waiting_approval';

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
