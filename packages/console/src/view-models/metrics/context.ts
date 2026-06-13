import { asRecord } from '@fdekit/core';
import type {
  ApprovalArtifact,
  AuditLogEntry,
  EvalCaseResult,
  TraceArtifact,
  TraceEvent,
} from '@fdekit/runtime';
import type { ConsoleData } from '../../interfaces/index.js';
import { collectEvalCases } from '../evals.js';
import { createReviewArtifactScope } from '../review-scope.js';

export interface MetricsContext {
  data: ConsoleData;
  traces: TraceArtifact[];
  traceIds: Set<string>;
  approvals: ApprovalArtifact[];
  auditLog: AuditLogEntry[];
  allTraceCount: number;
  traceScope: 'latest_eval' | 'all_traces';
  events: TraceEvent[];
  toolEvents: TraceEvent[];
  policyEvents: TraceEvent[];
  completedRuns: TraceEvent[];
  evalCases: EvalCaseResult[];
  evalStatus: string;
  evalPassedCases: number;
  latestRunSummary: Record<string, unknown>;
  latestPolicyViolationCount: number;
  reportReady: boolean;
}

export function createMetricsContext(data: ConsoleData): MetricsContext {
  const reviewScope = createReviewArtifactScope(data);
  const events = reviewScope.traces.flatMap((trace) => trace.events ?? []);
  const toolEvents = events.filter((event) => event.type === 'tool.call.completed');
  const policyEvents = events.filter((event) => event.type === 'policy.evaluated');
  const completedRuns = events.filter((event) => event.type === 'agent.run.completed');
  const evalCases = collectEvalCases(data.latestEval ?? null);
  const latestRunSummary = asRecord(completedRuns.at(-1));

  return {
    data,
    traces: reviewScope.traces,
    traceIds: reviewScope.traceIds,
    approvals: reviewScope.approvals,
    auditLog: reviewScope.auditLog,
    allTraceCount: reviewScope.allTraceCount,
    traceScope: reviewScope.traceScope,
    events,
    toolEvents,
    policyEvents,
    completedRuns,
    evalCases,
    evalStatus: data.latestEval?.status ?? 'not run',
    evalPassedCases: evalCases.filter((evalCase) => evalCase.status === 'passed').length,
    latestRunSummary,
    latestPolicyViolationCount: Array.isArray(latestRunSummary.policyViolations)
      ? latestRunSummary.policyViolations.length
      : 0,
    reportReady: Boolean(data.reportMarkdown?.trim()),
  };
}
