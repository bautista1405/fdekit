import type { DeploymentDefinition } from './deployment.js';
import type { MaybePromise } from './shared.js';

export interface EvalAssertionResult {
  passed: boolean;
  message?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface EvalAssertionConfigurationIssue {
  path?: string;
  message: string;
}

export interface EvalRunContext {
  deploymentName?: string;
  agentName?: string;
  input?: unknown;
  expected?: unknown;
  output?: unknown;
  finalAnswer?: string;
  toolCalls?: Array<{ name: string; args?: unknown; result?: unknown }>;
  policyViolations?: Array<{ policy: string; reason?: string }>;
  costUsd?: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

export interface EvalAssertion {
  name: string;
  description?: string;
  configurationIssues?: EvalAssertionConfigurationIssue[];
  evaluate: (context: EvalRunContext) => MaybePromise<EvalAssertionResult>;
}

export interface EvalCase {
  name: string;
  input: unknown;
  expected?: unknown;
  assertions?: EvalAssertion[];
  metadata?: Record<string, unknown>;
}

export interface EvalDefinition {
  name: string;
  version?: string;
  description?: string;
  agent?: string;
  dataset?: string;
  maxSteps?: number;
  cases?: EvalCase[];
  assertions?: EvalAssertion[];
  run?: (deployment: DeploymentDefinition) => MaybePromise<unknown>;
}
