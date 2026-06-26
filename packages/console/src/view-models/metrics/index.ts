import { getString } from '@fdekit/core';
import type {
  ConsoleData,
  ConsoleMetrics,
} from '../../interfaces/index.js';
import { createMetricsContext } from './context.js';
import { collectEvalMetrics } from './evals.js';
import { collectEvidenceMetrics } from './evidence.js';
import { collectGovernanceMetrics } from './governance.js';
import { collectReadinessMetrics } from './readiness.js';
import { collectToolMetrics } from './tools.js';

export function calculateMetrics(data: ConsoleData): ConsoleMetrics {
  const context = createMetricsContext(data);
  const evalMetrics = collectEvalMetrics(context);
  const evidenceMetrics = collectEvidenceMetrics(context);
  const governanceWithInternals = collectGovernanceMetrics(context);
  const { openApprovalCount: _openApprovalCount, ...governanceMetrics } = governanceWithInternals;
  const toolMetrics = collectToolMetrics(context);
  const reliabilityMetrics = collectReliabilityMetrics(evidenceMetrics.allRunHistory);
  const readinessMetrics = collectReadinessMetrics({
    context,
    evalMetrics,
    evidenceMetrics,
    governanceMetrics: governanceWithInternals,
    toolMetrics,
    policyBlockedRunCount: reliabilityMetrics.policyBlockedRunCount,
  });

  return {
    traceCount: context.traces.length,
    allTraceCount: context.allTraceCount,
    traceScope: context.traceScope,
    ...evalMetrics,
    ...readinessMetrics,
    ...governanceMetrics,
    ...toolMetrics,
    ...evidenceMetrics,
    ...reliabilityMetrics,
    reportReady: context.reportReady,
    latestRunSummary: context.latestRunSummary,
    finalAnswer: getString(context.latestRunSummary.message) ?? null,
  };
}

function collectReliabilityMetrics(allRunHistory: ConsoleMetrics['allRunHistory']): Pick<
  ConsoleMetrics,
  | 'totalRunCount'
  | 'completedRunCount'
  | 'policyBlockedRunCount'
  | 'reliabilityFailureCount'
  | 'successRate'
  | 'reliabilityStatus'
> {
  const totalRunCount = allRunHistory.length;
  const completedRunCount = allRunHistory.filter((run) => isCompletedStatus(run.status)).length;
  const policyBlockedRunCount = allRunHistory.filter((run) => run.failureCategory === 'policy-block').length;
  const reliabilityFailureCount = allRunHistory
    .filter((run) => !isCompletedStatus(run.status) && run.failureCategory !== 'policy-block')
    .length;
  const reliableOutcomeCount = completedRunCount + policyBlockedRunCount;
  const successRate = totalRunCount > 0 ? reliableOutcomeCount / totalRunCount : 0;

  return {
    totalRunCount,
    completedRunCount,
    policyBlockedRunCount,
    reliabilityFailureCount,
    successRate,
    reliabilityStatus: reliabilityStatus(totalRunCount, successRate),
  };
}

function isCompletedStatus(status: string): boolean {
  const normalized = status.toLowerCase();

  return normalized === 'completed'
    || normalized === 'passed'
    || normalized === 'succeeded'
    || normalized === 'success';
}

function reliabilityStatus(totalRunCount: number, successRate: number): 'pass' | 'warn' | 'fail' {
  if (totalRunCount === 0) {
    return 'warn';
  }

  if (successRate >= 0.95) {
    return 'pass';
  }

  if (successRate >= 0.8) {
    return 'warn';
  }

  return 'fail';
}
