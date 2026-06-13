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
  const readinessMetrics = collectReadinessMetrics({
    context,
    evalMetrics,
    evidenceMetrics,
    governanceMetrics: governanceWithInternals,
    toolMetrics,
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
    reportReady: context.reportReady,
    latestRunSummary: context.latestRunSummary,
    finalAnswer: getString(context.latestRunSummary.message) ?? null,
  };
}
