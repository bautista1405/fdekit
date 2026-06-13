import type { ConsoleMetrics } from '../../interfaces/index.js';
import {
  collectEvalSuites,
  collectSnapshotTrend,
} from '../evals.js';
import type { MetricsContext } from './context.js';

export type EvalMetrics = Pick<
  ConsoleMetrics,
  'evalStatus' | 'evalCaseCount' | 'evalPassedCases' | 'evalSuites' | 'snapshotTrend'
>;

export function collectEvalMetrics(context: MetricsContext): EvalMetrics {
  return {
    evalStatus: context.evalStatus,
    evalCaseCount: context.evalCases.length,
    evalPassedCases: context.evalPassedCases,
    evalSuites: collectEvalSuites(context.data.latestEval ?? null),
    snapshotTrend: collectSnapshotTrend(context.data.history ?? []),
  };
}
