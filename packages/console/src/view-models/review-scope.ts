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
  traceScope: 'latest_eval' | 'latest_run' | 'all_traces';
}

export function createReviewArtifactScope(data: ConsoleData): ReviewArtifactScope {
  const allTraces = sortTracesByCreatedAt(data.traces);
  const latestEvalTraceIds = collectLatestEvalTraceIds(data);
  const activeTraces = latestEvalTraceIds.size > 0
    ? allTraces.filter((trace) => latestEvalTraceIds.has(trace.id))
    : [];

  if (activeTraces.length > 0) {
    return createScopedArtifacts(data, allTraces, activeTraces, 'latest_eval');
  }

  const latestRunTrace = findLatestCompletedTrace(allTraces) ?? allTraces.at(-1);

  if (latestRunTrace) {
    return createScopedArtifacts(data, allTraces, [latestRunTrace], 'latest_run');
  }

  return {
    traces: allTraces,
    traceIds: new Set(),
    approvals: data.approvals ?? [],
    auditLog: data.auditLog ?? [],
    allTraceCount: allTraces.length,
    traceScope: 'all_traces',
  };
}

function createScopedArtifacts(
  data: ConsoleData,
  allTraces: TraceArtifact[],
  activeTraces: TraceArtifact[],
  traceScope: 'latest_eval' | 'latest_run',
): ReviewArtifactScope {
  const activeTraceIds = new Set(activeTraces.map((trace) => trace.id));

  return {
    traces: activeTraces,
    traceIds: activeTraceIds,
    // Decided approvals are scoped to the reviewed traces, but pending ones are
    // always global: the review page is where a human looks for open work, so a
    // pending request from an older run must not disappear behind the scope.
    approvals: mergePendingApprovals(data.approvals ?? [], activeTraceIds),
    auditLog: (data.auditLog ?? []).filter((entry) => artifactMatchesTraceScope(entry, activeTraceIds)),
    allTraceCount: allTraces.length,
    traceScope,
  };
}

function mergePendingApprovals(
  approvals: ApprovalArtifact[],
  activeTraceIds: Set<string>,
): ApprovalArtifact[] {
  return approvals.filter((approval) =>
    approval.status === 'pending' || artifactMatchesTraceScope(approval, activeTraceIds));
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

function findLatestCompletedTrace(traces: TraceArtifact[]): TraceArtifact | undefined {
  return [...traces]
    .reverse()
    .find((trace) => (trace.events ?? []).some((event) => event.type === 'agent.run.completed'));
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
