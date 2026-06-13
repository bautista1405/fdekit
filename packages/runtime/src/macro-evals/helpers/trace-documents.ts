import { asRecord, getString } from '@fdekit/core';
import type { TraceArtifact, TraceEvent } from '../../traces/index.js';
import {
  indexToolMetadata,
  mergeToolMetadataIndexes,
  type ToolMetadata,
  type ToolMetadataIndex,
} from '../../tool-metadata.js';
import type { MacroEvalFinding, MacroEvalTraceDocument } from '../interfaces/index.js';
import type { EvalLabel } from './eval-labels.js';
import { findLastEvent, isString, truncate, unique } from './common.js';
import { runOutcomeFindings } from './findings.js';
import { inferBehaviorSignals } from './signals.js';

export function buildTraceDocument(
  trace: TraceArtifact,
  label: EvalLabel | undefined,
  deploymentToolMetadata: ToolMetadataIndex = new Map(),
): MacroEvalTraceDocument {
  const completed = findLastEvent(trace.events, 'agent.run.completed');
  const runOutcome = getString(completed?.status) ?? (label?.status === 'failed' ? 'failed' : 'completed');
  const toolCalls = collectToolCalls(trace.events, completed);
  const toolMetadata = mergeToolMetadataIndexes(deploymentToolMetadata, collectTraceToolMetadata(trace.events));
  const finalAnswer = getString(completed?.message);
  const policyFindings = collectPolicyFindings(trace.events, completed);
  const approvalFindings = collectApprovalFindings(trace.events);
  const evalFindings = [
    ...(label?.findings ?? []),
    ...policyFindings.findings,
    ...approvalFindings.findings,
    ...runOutcomeFindings(runOutcome),
  ];
  const caseType = inferCaseType(label);
  const behaviorSignals = inferBehaviorSignals({
    runOutcome,
    toolCalls,
    toolMetadata,
    evalFindings,
    policyEvents: policyFindings.events,
    approvalEvents: approvalFindings.events,
  });
  const compactDocument = renderTraceDocument({
    trace,
    label,
    caseType,
    runOutcome,
    toolCalls,
    evalFindings,
    policyEvents: policyFindings.events,
    approvalEvents: approvalFindings.events,
    finalAnswer,
  });

  return {
    traceId: trace.id,
    deployment: trace.deployment,
    createdAt: trace.createdAt,
    caseType,
    runOutcome,
    evalStatus: label?.status ?? 'unknown',
    evalFindings,
    behaviorSignals,
    toolCalls,
    policyEvents: policyFindings.events,
    approvalEvents: approvalFindings.events,
    finalAnswer,
    compactDocument,
    metadata: {
      suiteName: label?.suiteName,
      caseName: label?.caseName,
      input: label?.input,
      expected: label?.expected,
    },
  };
}

function collectToolCalls(events: TraceEvent[], completed: TraceEvent | undefined): string[] {
  const fromEvents = events
    .filter((event) => event.type === 'tool.call.completed')
    .map((event) => getString(event.toolName))
    .filter(isString);

  if (fromEvents.length > 0) {
    return fromEvents;
  }

  const completedCalls = completed?.toolCalls;
  return Array.isArray(completedCalls) ? completedCalls.map((value) => String(value)) : [];
}

function collectTraceToolMetadata(events: TraceEvent[]): ToolMetadataIndex {
  return indexToolMetadata(events
    .filter((event) => event.type === 'tool.call.started' || event.type === 'tool.call.completed')
    .map(traceEventToolMetadata)
    .filter((tool): tool is ToolMetadata => Boolean(tool)));
}

function traceEventToolMetadata(event: TraceEvent): ToolMetadata | undefined {
  const name = getString(event.toolName);

  if (!name) {
    return undefined;
  }

  return {
    name,
    category: getString(event.toolCategory),
    tags: stringList(event.toolTags),
    scopes: stringList(event.toolScopes),
    environments: stringList(event.toolAllowedEnvironments),
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function collectPolicyFindings(
  events: TraceEvent[],
  completed: TraceEvent | undefined,
): { events: string[]; findings: MacroEvalFinding[] } {
  const policyEvents = events
    .filter((event) => event.type === 'policy.evaluated')
    .filter((event) => event.allowed === false || event.approvalRequired === true)
    .map((event) => getString(event.policy))
    .filter(isString);
  const completedViolations = Array.isArray(completed?.policyViolations)
    ? completed?.policyViolations.map(asRecord)
    : [];
  const completedPolicies = completedViolations.map((violation) => getString(violation.policy)).filter(isString);
  const policies = unique([...policyEvents, ...completedPolicies]);
  const findings = completedViolations.map((violation): MacroEvalFinding => ({
    category: 'policy or guardrail',
    message: getString(violation.reason) ?? `Policy ${getString(violation.policy) ?? 'unknown'} blocked or paused the run`,
    severity: violation.approvalRequired === true ? 'medium' : 'high',
    source: 'policy',
  }));

  return {
    events: policies,
    findings,
  };
}

function collectApprovalFindings(events: TraceEvent[]): { events: string[]; findings: MacroEvalFinding[] } {
  const approvalEvents = events
    .filter((event) => event.type === 'approval.requested' || event.type === 'approval.satisfied')
    .map((event) => `${getString(event.policy) ?? 'approval'}:${getString(event.toolName) ?? 'unknown-tool'}`);

  return {
    events: approvalEvents,
    findings: approvalEvents.map((event): MacroEvalFinding => ({
      category: 'human review',
      message: `Approval gate observed for ${event}`,
      severity: 'medium',
      source: 'approval',
    })),
  };
}

function inferCaseType(label: EvalLabel | undefined): string {
  const metadata = label?.metadata ?? {};
  const expected = asRecord(label?.expected);
  const input = asRecord(label?.input);
  const candidates = [
    metadata.caseType,
    metadata.case_type,
    expected.caseType,
    expected.case_type,
    expected.outcome,
    expected.issueType,
    input.caseType,
    input.case_type,
    label?.caseName,
  ];

  return candidates.map(getString).find(isString) ?? 'unlabeled case';
}

function renderTraceDocument(input: {
  trace: TraceArtifact;
  label: EvalLabel | undefined;
  caseType: string;
  runOutcome: string;
  toolCalls: string[];
  evalFindings: MacroEvalFinding[];
  policyEvents: string[];
  approvalEvents: string[];
  finalAnswer?: string;
}): string {
  return [
    `trace_id: ${input.trace.id}`,
    `deployment: ${input.trace.deployment}`,
    `case_type: ${input.caseType}`,
    `run_outcome: ${input.runOutcome}`,
    `lower_level_eval: ${input.label ? `${input.label.status} (${input.label.suiteName} / ${input.label.caseName})` : 'not available'}`,
    `eval_findings: ${input.evalFindings.map((finding) => `${finding.category}: ${finding.message}`).join(' | ') || 'none'}`,
    `tool_path: ${input.toolCalls.join(' -> ') || 'none'}`,
    `policy_events: ${input.policyEvents.join(', ') || 'none'}`,
    `approval_events: ${input.approvalEvents.join(', ') || 'none'}`,
    `final_answer: ${truncate(input.finalAnswer ?? 'none', 220)}`,
  ].join('\n');
}
