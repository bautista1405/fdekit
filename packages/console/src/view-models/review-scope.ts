import type {
  ApprovalArtifact,
  AuditLogEntry,
  TraceArtifact,
} from '@fdekit/runtime';
import type { ConsoleData } from '../interfaces/index.js';
import { collectEvalCases } from './evals.js';

export interface ReviewArtifactScope {
  traces: TraceArtifact[];
  traceIds: Set<string>;
  approvals: ApprovalArtifact[];
  auditLog: AuditLogEntry[];
  allTraceCount: number;
  traceScope: 'latest_eval' | 'all_traces';
}

export function createReviewArtifactScope(data: ConsoleData): ReviewArtifactScope {
  const allTraces = sortTracesByCreatedAt(data.traces);
  const latestEvalTraceIds = collectLatestEvalTraceIds(data);
  const activeTraces = latestEvalTraceIds.size > 0
    ? allTraces.filter((trace) => latestEvalTraceIds.has(trace.id))
    : [];

  if (activeTraces.length === 0) {
    const allTraceIds = new Set(allTraces.map((trace) => trace.id));

    return {
      traces: allTraces,
      traceIds: allTraceIds,
      approvals: data.approvals ?? [],
      auditLog: data.auditLog ?? [],
      allTraceCount: allTraces.length,
      traceScope: 'all_traces',
    };
  }

  const activeTraceIds = new Set(activeTraces.map((trace) => trace.id));

  return {
    traces: activeTraces,
    traceIds: activeTraceIds,
    approvals: (data.approvals ?? []).filter((approval) => artifactMatchesTraceScope(approval, activeTraceIds)),
    auditLog: (data.auditLog ?? []).filter((entry) => artifactMatchesTraceScope(entry, activeTraceIds)),
    allTraceCount: allTraces.length,
    traceScope: 'latest_eval',
  };
}

export function selectReviewTraces(data: ConsoleData): TraceArtifact[] {
  return createReviewArtifactScope(data).traces;
}

function collectLatestEvalTraceIds(data: ConsoleData): Set<string> {
  return new Set(collectEvalCases(data.latestEval ?? null)
    .map((evalCase) => evalCase.traceId)
    .filter((traceId): traceId is string => typeof traceId === 'string' && traceId.trim().length > 0));
}

function sortTracesByCreatedAt(traces: TraceArtifact[]): TraceArtifact[] {
  return [...traces].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function artifactMatchesTraceScope(
  artifact: { traceId?: string; runId?: string },
  traceIds: Set<string>,
): boolean {
  return Boolean(
    (artifact.traceId && traceIds.has(artifact.traceId))
    || (artifact.runId && traceIds.has(artifact.runId)),
  );
}
