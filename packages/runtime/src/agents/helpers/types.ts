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
  policies: PolicyDefinition[];
  edgeMode: RuntimeEdgeMode;
  toolCalls: AgentToolCall[];
  policyViolations: PolicyViolation[];
  approvals: ApprovalArtifact[];
  events: TraceEvent[];
  costUsd: number;
}
