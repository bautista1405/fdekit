import type {
  ContextBudget,
  ContextItem,
  ContextObjectives,
  ExecutionIdentity,
  ModelContext,
  ModelToolDefinition,
  SkillReference,
} from './execution.js';
import type { InferenceEndpointReference, InferenceTarget } from './inference.js';

export interface RetrievalAuthorizationDenial {
  sourceId: string;
  reason: 'policy_denied' | 'capability_missing' | 'approval_required' | 'source_not_allowed';
}

/** Produced before source access; content is deliberately absent. */
export interface RetrievalAuthorizationPlan {
  schemaVersion: 1;
  policyFingerprint: string;
  decision: 'allow' | 'deny' | 'needs_approval';
  createdAt: string;
  allowedSourceIds: string[];
  deniedSources: RetrievalAuthorizationDenial[];
}

export interface ContextPlannerCandidate {
  item: ContextItem;
  estimatedTokens: number;
  sourceIds?: string[];
  required?: boolean;
  priority?: number;
  scores?: Partial<ContextObjectives>;
}

export interface SkillPlannerCandidate {
  skill: SkillReference;
  estimatedTokens: number;
  required?: boolean;
  priority?: number;
}

export interface ToolPlannerCandidate {
  tool: ModelToolDefinition;
  estimatedTokens: number;
  required?: boolean;
  priority?: number;
}

export type ContextSelectionKind = ContextItem['kind'] | 'skill' | 'tool';
export type ContextExclusionReason =
  | 'policy_denied'
  | 'approval_required'
  | 'source_not_authorized'
  | 'token_budget'
  | 'retrieval_limit'
  | 'tool_limit'
  | 'lower_priority';

export interface ContextSelectionEntry {
  id: string;
  kind: ContextSelectionKind;
  estimatedTokens: number;
  required: boolean;
  decision: 'selected' | 'excluded';
  reason: 'required' | 'ranked' | ContextExclusionReason;
  sourceIds?: string[];
}

export interface ContextSelectionManifest {
  schemaVersion: 1;
  selected: ContextSelectionEntry[];
  excluded: ContextSelectionEntry[];
}

export interface ContextPlanFeasibility {
  status: 'feasible' | 'needs_input' | 'needs_approval' | 'blocked';
  reasons: string[];
}

export interface StepContextPlan {
  schemaVersion: 1;
  identity?: ExecutionIdentity;
  target: InferenceTarget;
  endpoint: InferenceEndpointReference;
  budget: ContextBudget;
  objectives: ContextObjectives;
  inputTokenLimit: number;
  estimatedInputTokens: number;
  feasibility: ContextPlanFeasibility;
  model: ModelContext;
  manifest: ContextSelectionManifest;
}
