import type { TraceArtifact, TraceEvent } from './interfaces/index.js';

/**
 * How much a run is worth putting in front of a reviewer.
 *
 * Reports and the console both have to answer "which run do we show?", and
 * answering it with recency alone puts whichever run happened to go last in the
 * stakeholder artifact - typically a smoke run with no tool calls, while the
 * governed run that cleared three approvals and filed an issue sits unreferenced
 * in the same directory.
 *
 * Evidence is what makes a run worth reviewing, so approvals and completed tool
 * calls outrank raw event volume, and recency only settles ties.
 */
export interface TraceSignificance {
  approvals: number;
  toolCalls: number;
  policyDecisions: number;
  score: number;
}

const APPROVAL_WEIGHT = 5;
const TOOL_CALL_WEIGHT = 3;
const POLICY_DECISION_WEIGHT = 1;

export function scoreTraceSignificance(trace: TraceArtifact): TraceSignificance {
  let approvals = 0;
  let toolCalls = 0;
  let policyDecisions = 0;

  for (const event of trace.events ?? []) {
    if (isApprovalEvent(event)) {
      approvals += 1;
      continue;
    }

    if (event.type === 'tool.call.completed') {
      toolCalls += 1;
      continue;
    }

    if (isEnforcedPolicyEvent(event)) {
      policyDecisions += 1;
    }
  }

  return {
    approvals,
    toolCalls,
    policyDecisions,
    score: approvals * APPROVAL_WEIGHT
      + toolCalls * TOOL_CALL_WEIGHT
      + policyDecisions * POLICY_DECISION_WEIGHT,
  };
}

/**
 * Picks the run a reviewer should see: richest evidence first, most recent to
 * break ties. Returns null only when there are no traces at all.
 */
export function selectReviewedTrace(traces: TraceArtifact[]): TraceArtifact | null {
  let best: TraceArtifact | null = null;
  let bestScore = -1;

  for (const trace of traces) {
    const { score } = scoreTraceSignificance(trace);

    if (
      score > bestScore
      || (score === bestScore && best !== null && trace.createdAt.localeCompare(best.createdAt) > 0)
    ) {
      best = trace;
      bestScore = score;
    }
  }

  return best;
}

/** An approval gate that fired - requested, satisfied, or auto-decided. */
export function isApprovalEvent(event: TraceEvent): boolean {
  return typeof event.type === 'string' && event.type.startsWith('approval.');
}

/**
 * A policy evaluation that actually stopped something. `policy.evaluated` is
 * emitted for every check, so only the denials count as enforcement.
 */
export function isEnforcedPolicyEvent(event: TraceEvent): boolean {
  return event.type === 'policy.evaluated' && (event as { allowed?: unknown }).allowed === false;
}
