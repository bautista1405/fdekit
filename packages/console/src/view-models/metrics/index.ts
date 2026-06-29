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
import { calculateReadinessScore } from '../readiness.js';
import { percentile } from '../format.js';

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
  const healthMetrics = collectHealthMetrics({
    readinessSignals: readinessMetrics.readinessSignals,
    allRunHistory: evidenceMetrics.allRunHistory,
    successRate: reliabilityMetrics.successRate,
    totalRunCount: reliabilityMetrics.totalRunCount,
  });

  return {
    traceCount: context.traces.length,
    allTraceCount: context.allTraceCount,
    traceScope: context.traceScope,
    ...evalMetrics,
    ...readinessMetrics,
    ...healthMetrics,
    ...governanceMetrics,
    ...toolMetrics,
    ...evidenceMetrics,
    ...reliabilityMetrics,
    reportReady: context.reportReady,
    latestRunSummary: context.latestRunSummary,
    finalAnswer: getString(context.latestRunSummary.message) ?? null,
  };
}

function collectHealthMetrics(input: {
  readinessSignals: ConsoleMetrics['readinessSignals'];
  allRunHistory: ConsoleMetrics['allRunHistory'];
  successRate: number;
  totalRunCount: number;
}): Pick<
  ConsoleMetrics,
  'readinessScore' | 'healthStatus' | 'latencyStatus' | 'fleetAvgLatencyMs' | 'fleetP95LatencyMs'
> {
  const fleetLatencies = input.allRunHistory
    .map((run) => run.latencyMs)
    .filter((latency) => latency >= 0);
  const fleetAvgLatencyMs = fleetLatencies.length > 0
    ? fleetLatencies.reduce((total, latency) => total + latency, 0) / fleetLatencies.length
    : 0;
  const fleetP95LatencyMs = percentile(fleetLatencies, 95);
  const declarationScore = calculateReadinessScore(input.readinessSignals) / 100;
  const reliabilityScore = input.totalRunCount > 0 ? input.successRate : 0.55;
  const latencyScore = latencyScoreFor(fleetP95LatencyMs, input.totalRunCount);
  const rawScore = Math.round(100 * (
    (reliabilityScore * 0.6)
    + (latencyScore * 0.25)
    + (declarationScore * 0.15)
  ));
  const latencyStatus = latencyStatusFor(fleetP95LatencyMs, input.totalRunCount);
  const healthStatus = healthStatusFor(input.successRate, input.totalRunCount, latencyStatus);

  return {
    readinessScore: capHealthScore(rawScore, healthStatus),
    healthStatus,
    latencyStatus,
    fleetAvgLatencyMs,
    fleetP95LatencyMs,
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

function latencyScoreFor(p95LatencyMs: number, totalRunCount: number): number {
  if (totalRunCount === 0) {
    return 0.55;
  }

  if (p95LatencyMs <= 10_000) {
    return 1;
  }

  if (p95LatencyMs <= 30_000) {
    return 0.55;
  }

  return 0;
}

function latencyStatusFor(p95LatencyMs: number, totalRunCount: number): 'pass' | 'warn' | 'fail' {
  if (totalRunCount === 0) {
    return 'warn';
  }

  if (p95LatencyMs > 30_000) {
    return 'fail';
  }

  if (p95LatencyMs > 10_000) {
    return 'warn';
  }

  return 'pass';
}

function healthStatusFor(
  successRate: number,
  totalRunCount: number,
  latencyStatus: 'pass' | 'warn' | 'fail',
): 'pass' | 'warn' | 'fail' {
  if (totalRunCount === 0) {
    return 'warn';
  }

  if (successRate < 0.8 || latencyStatus === 'fail') {
    return 'fail';
  }

  if (successRate < 0.9 || latencyStatus === 'warn') {
    return 'warn';
  }

  return 'pass';
}

function capHealthScore(score: number, status: 'pass' | 'warn' | 'fail'): number {
  if (status === 'fail') {
    return Math.min(score, 69);
  }

  if (status === 'warn') {
    return Math.min(score, 89);
  }

  return score;
}
