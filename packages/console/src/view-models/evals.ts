import type { EvalArtifact, EvalCaseResult, EvalSuiteResult } from '@fdekit/runtime';
import type { EvalSuiteSummary, SnapshotTrendItem, ConsoleHistoryEntry } from '../interfaces/index.js';

export function collectEvalCases(evalArtifact: EvalArtifact | null): EvalCaseResult[] {
  if (!evalArtifact) {
    return [];
  }

  return evalArtifact.results.flatMap((suite: EvalSuiteResult) => suite.cases ?? []);
}

export function collectEvalSuites(evalArtifact: EvalArtifact | null): EvalSuiteSummary[] {
  if (!evalArtifact) {
    return [];
  }

  return evalArtifact.results.map((suite) => {
    const cases = suite.cases ?? [];
    const passed = cases.filter((evalCase) => evalCase.status === 'passed').length;
    const failed = cases.filter((evalCase) => evalCase.status === 'failed').length;

    return {
      name: suite.name,
      status: suite.status,
      cases: cases.length,
      passed,
      failed,
    };
  });
}

export function collectSnapshotTrend(history: ConsoleHistoryEntry[]): SnapshotTrendItem[] {
  return history.map((entry) => ({
    createdAt: entry.createdAt,
    evalStatus: entry.evalStatus,
    traceCount: entry.traceCount,
    file: entry.file,
  }));
}
