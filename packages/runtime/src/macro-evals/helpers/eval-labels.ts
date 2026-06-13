import type { EvalArtifact } from '../../evals/index.js';
import type { MacroEvalFinding } from '../interfaces/index.js';
import { findingsFromEvalCase } from './findings.js';

export interface EvalLabel {
  suiteName: string;
  caseName: string;
  status: 'passed' | 'failed';
  input: unknown;
  expected?: unknown;
  metadata?: Record<string, unknown>;
  findings: MacroEvalFinding[];
}

export function collectEvalLabels(evalArtifact: EvalArtifact | null): Map<string, EvalLabel> {
  const labels = new Map<string, EvalLabel>();

  for (const suite of evalArtifact?.results ?? []) {
    for (const evalCase of suite.cases ?? []) {
      if (!evalCase.traceId) {
        continue;
      }

      labels.set(evalCase.traceId, {
        suiteName: suite.name,
        caseName: evalCase.name,
        status: evalCase.status,
        input: evalCase.input,
        expected: evalCase.expected,
        metadata: evalCase.metadata,
        findings: findingsFromEvalCase(suite, evalCase),
      });
    }
  }

  return labels;
}

export function countEvalCases(evalArtifact: EvalArtifact | null): number {
  return (evalArtifact?.results ?? []).reduce((total, suite) => total + (suite.cases?.length ?? 0), 0);
}

export function countEvalFailures(evalArtifact: EvalArtifact | null): number {
  return (evalArtifact?.results ?? []).reduce((total, suite) => total + (suite.cases?.filter((evalCase) => evalCase.status === 'failed').length ?? 0), 0);
}
