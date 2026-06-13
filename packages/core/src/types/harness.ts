import type { EvalDefinition } from './eval.js';
import type { PolicyDefinition } from './policy.js';
import type { AnyToolDefinition } from './tool.js';

export type HarnessToolRef = string | AnyToolDefinition;
export type HarnessPolicyRef = string | PolicyDefinition;
export type HarnessEvalRef = string | EvalDefinition;
export type HarnessTriggerRef = string | PolicyDefinition | EvalDefinition;

export interface HarnessPhaseDefinition {
  name: string;
  description?: string;
  instructions?: string;
  toolRefs?: string[];
  optionalToolRefs?: string[];
  policyRefs?: string[];
  evalRefs?: string[];
  artifactRefs?: string[];
  maxSteps?: number;
  humanOwner?: string;
  metadata?: Record<string, unknown>;
}

export interface HarnessReviewDefinition {
  evalRefs?: string[];
  artifactRefs?: string[];
  adversarial?: boolean;
  metadata?: Record<string, unknown>;
}

export interface HarnessSteerDefinition {
  enabled?: boolean;
  maxAttempts?: number;
  triggerRefs?: string[];
  metadata?: Record<string, unknown>;
}

export interface HarnessDefinition {
  name: string;
  version?: string;
  description?: string;
  phases: HarnessPhaseDefinition[];
  toolRefs?: string[];
  policyRefs?: string[];
  evalRefs?: string[];
  artifactRefs?: string[];
  maxSteps?: number;
  review?: HarnessReviewDefinition;
  steer?: HarnessSteerDefinition;
  metadata?: Record<string, unknown>;
}

export interface HarnessPhaseInput extends Omit<
  HarnessPhaseDefinition,
  'toolRefs' | 'optionalToolRefs' | 'policyRefs' | 'evalRefs'
> {
  toolRefs?: HarnessToolRef[];
  optionalToolRefs?: HarnessToolRef[];
  policyRefs?: HarnessPolicyRef[];
  evalRefs?: HarnessEvalRef[];
}

export interface HarnessReviewInput extends Omit<HarnessReviewDefinition, 'evalRefs'> {
  evalRefs?: HarnessEvalRef[];
}

export interface HarnessSteerInput extends Omit<HarnessSteerDefinition, 'triggerRefs'> {
  triggerRefs?: HarnessTriggerRef[];
}

export interface HarnessDefinitionInput extends Omit<
  HarnessDefinition,
  'phases' | 'toolRefs' | 'policyRefs' | 'evalRefs' | 'review' | 'steer'
> {
  phases: HarnessPhaseInput[];
  toolRefs?: HarnessToolRef[];
  policyRefs?: HarnessPolicyRef[];
  evalRefs?: HarnessEvalRef[];
  review?: HarnessReviewInput;
  steer?: HarnessSteerInput;
}
