import type { MacroEvalFinding, MacroEvalPattern, MacroEvalSuspect, MacroEvalTraceDocument } from '../interfaces/index.js';
import { countValues, formatCounts, humanizeSignal } from './common.js';

export function discoverBehaviorPatterns(documents: MacroEvalTraceDocument[], minFrequency: number): MacroEvalPattern[] {
  const groups = new Map<string, MacroEvalTraceDocument[]>();

  for (const document of documents) {
    for (const signal of document.behaviorSignals) {
      const items = groups.get(signal) ?? [];
      items.push(document);
      groups.set(signal, items);
    }
  }

  return [...groups.entries()]
    .filter(([, docs]) => docs.length >= minFrequency)
    .map(([signal, docs], index) => createPattern(signal, docs, index))
    .sort((left, right) => right.impactScore - left.impactScore || right.frequency - left.frequency || left.behaviorPattern.localeCompare(right.behaviorPattern));
}

function createPattern(signal: string, documents: MacroEvalTraceDocument[], index: number): MacroEvalPattern {
  const findings = documents.flatMap((document) => document.evalFindings);
  const severity = patternSeverity(findings, documents);
  const suspects = collectSuspects(documents);
  const representativeTraceId = pickRepresentativeTrace(documents);
  const impactScore = calculateImpactScore(documents, findings);
  const behaviorPattern = humanizeSignal(signal);
  const firstSuspect = suspects[0];

  return {
    id: `pattern_${index + 1}`,
    behaviorPattern,
    summary: summarizePattern(behaviorPattern, documents, findings),
    frequency: documents.length,
    impactScore,
    severity,
    affectedTraceIds: documents.map((document) => document.traceId),
    caseTypes: countValues(documents.map((document) => document.caseType)),
    runOutcomes: countValues(documents.map((document) => document.runOutcome)),
    evalFindings: countValues(findings.map((finding) => finding.category)).map(({ name, count }) => ({ category: name, count })),
    topTools: countValues(documents.flatMap((document) => document.toolCalls)),
    topPolicies: countValues(documents.flatMap((document) => document.policyEvents)),
    suspects,
    representativeTraceId,
    recommendedInspection: firstSuspect
      ? `Inspect ${firstSuspect.kind} "${firstSuspect.name}" around trace ${representativeTraceId}; compare the compact trace document with the lower-level eval findings before changing prompts or policies`
      : `Inspect representative trace ${representativeTraceId}; compare the compact trace document with the lower-level eval findings before changing prompts or policies`,
  };
}

function collectSuspects(documents: MacroEvalTraceDocument[]): MacroEvalSuspect[] {
  const candidates = [
    ...countValues(documents.flatMap((document) => document.policyEvents)).map((item) => ({ kind: 'policy' as const, ...item })),
    ...countValues(documents.flatMap((document) => document.approvalEvents)).map((item) => ({ kind: 'approval' as const, ...item })),
    ...countValues(documents.flatMap((document) => document.toolCalls)).map((item) => ({ kind: 'tool' as const, ...item })),
    ...countValues(documents.flatMap((document) => document.behaviorSignals)).map((item) => ({ kind: 'event' as const, ...item })),
  ];

  return candidates
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || suspectRank(left.kind) - suspectRank(right.kind) || left.name.localeCompare(right.name))
    .slice(0, 8)
    .map((item) => ({
      ...item,
      traceIds: documents
        .filter((document) => suspectValues(item.kind, document).includes(item.name))
        .map((document) => document.traceId),
    }));
}

function suspectValues(kind: MacroEvalSuspect['kind'], document: MacroEvalTraceDocument): string[] {
  if (kind === 'policy') return document.policyEvents;
  if (kind === 'approval') return document.approvalEvents;
  if (kind === 'tool') return document.toolCalls;
  return document.behaviorSignals;
}

function suspectRank(kind: MacroEvalSuspect['kind']): number {
  return { policy: 0, approval: 1, tool: 2, event: 3 }[kind];
}

function patternSeverity(findings: MacroEvalFinding[], documents: MacroEvalTraceDocument[]): 'low' | 'medium' | 'high' {
  if (findings.some((finding) => finding.severity === 'high') || documents.some((document) => document.runOutcome === 'failed')) {
    return 'high';
  }

  if (findings.some((finding) => finding.severity === 'medium') || documents.some((document) => document.runOutcome === 'waiting_approval')) {
    return 'medium';
  }

  return 'low';
}

function calculateImpactScore(documents: MacroEvalTraceDocument[], findings: MacroEvalFinding[]): number {
  const failedRuns = documents.filter((document) => document.runOutcome === 'failed' || document.evalStatus === 'failed').length;
  const reviewRuns = documents.filter((document) => document.runOutcome === 'waiting_approval' || document.approvalEvents.length > 0).length;
  const highFindings = findings.filter((finding) => finding.severity === 'high').length;
  const mediumFindings = findings.filter((finding) => finding.severity === 'medium').length;

  return documents.length + failedRuns * 4 + reviewRuns * 2 + highFindings * 2 + mediumFindings;
}

function summarizePattern(pattern: string, documents: MacroEvalTraceDocument[], findings: MacroEvalFinding[]): string {
  const caseTypes = formatCounts(countValues(documents.map((document) => document.caseType)).slice(0, 2));
  const outcomes = formatCounts(countValues(documents.map((document) => document.runOutcome)).slice(0, 2));
  const findingText = formatCounts(countValues(findings.map((finding) => finding.category)).slice(0, 2));

  return `${pattern} appears in ${documents.length} trace(s); case types: ${caseTypes || 'mixed'}; outcomes: ${outcomes || 'unknown'}; findings: ${findingText || 'none'}`;
}

function pickRepresentativeTrace(documents: MacroEvalTraceDocument[]): string {
  return documents
    .slice()
    .sort((left, right) => documentWeight(right) - documentWeight(left) || left.createdAt.localeCompare(right.createdAt))[0]?.traceId ?? 'unknown';
}

function documentWeight(document: MacroEvalTraceDocument): number {
  const severity = document.evalFindings.reduce((total, finding) => total + (finding.severity === 'high' ? 3 : finding.severity === 'medium' ? 2 : 1), 0);
  return severity + document.policyEvents.length * 2 + document.approvalEvents.length * 2 + document.toolCalls.length;
}
