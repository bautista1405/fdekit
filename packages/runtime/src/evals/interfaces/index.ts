import type {
  DeploymentDefinition,
  EvalAssertionResult,
  EvalDefinition,
  ProviderRuntimeRegistry,
} from '@fdekit/core';
import type { ArtifactStore } from '../../artifact-store/index.js';

export interface LoadedEval {
  scope: string;
  name: string;
  definition: EvalDefinition;
}

export interface EvalCaseResult {
  name: string;
  status: 'passed' | 'failed';
  input: unknown;
  expected?: unknown;
  metadata?: Record<string, unknown>;
  finalAnswer?: string;
  toolCalls: string[];
  traceId?: string;
  assertions: EvalAssertionResult[];
}

export interface EvalSuiteResult {
  scope: string;
  name: string;
  status: 'passed' | 'failed';
  assertions?: EvalAssertionResult[];
  cases?: EvalCaseResult[];
  result?: unknown;
}

export interface EvalArtifact {
  id: string;
  createdAt: string;
  deployment: string;
  status: 'passed' | 'failed';
  results: EvalSuiteResult[];
}

export interface RunEvalsOptions {
  deployment: DeploymentDefinition;
  projectDir: string;
  writeTraces?: boolean;
  providerRegistry?: ProviderRuntimeRegistry;
  artifactStore?: ArtifactStore;
}
