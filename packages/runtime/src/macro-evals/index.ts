import type { DeploymentDefinition } from '@fdekit/core';
import type { MacroEvalArtifact, MacroEvalFinding, MacroEvalPattern, MacroEvalSuspect, MacroEvalTraceDocument, RunMacroEvalsOptions } from './interfaces/index.js';
export type { MacroEvalArtifact, MacroEvalFinding, MacroEvalPattern, MacroEvalSuspect, MacroEvalTraceDocument, RunMacroEvalsOptions } from './interfaces/index.js';

import {
  buildTraceDocument,
  collectEvalLabels,
  countEvalCases,
  countEvalFailures,
  countValues,
  createMacroEvalId,
  discoverBehaviorPatterns,
  escapeMarkdown,
  formatCounts,
} from './helpers/index.js';
import { buildToolMetadataIndex } from '../tool-metadata.js';
export function runMacroEvals(options: RunMacroEvalsOptions): MacroEvalArtifact {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const minFrequency = options.minFrequency ?? 1;
  const labelsByTrace = collectEvalLabels(options.evalArtifact ?? null);
  const toolMetadata = buildToolMetadataIndex(options.deployment);
  const traceDocuments = options.traces
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((trace) => buildTraceDocument(trace, labelsByTrace.get(trace.id), toolMetadata));
  const patterns = discoverBehaviorPatterns(traceDocuments, minFrequency)
    .slice(0, options.maxPatterns ?? 12);

  return {
    id: createMacroEvalId(),
    createdAt,
    deployment: options.deployment.name,
    source: {
      traceCount: traceDocuments.length,
      evalArtifactId: options.evalArtifact?.id,
      evalStatus: options.evalArtifact?.status,
      minFrequency,
    },
    lowerLevelSummary: {
      evalCases: countEvalCases(options.evalArtifact ?? null),
      evalFailures: countEvalFailures(options.evalArtifact ?? null),
      runOutcomes: countValues(traceDocuments.map((document) => document.runOutcome)),
      caseTypes: countValues(traceDocuments.map((document) => document.caseType)),
    },
    traceDocuments,
    patterns,
    focusPattern: patterns[0],
  };
}

export function renderMacroEvalReport(artifact: MacroEvalArtifact): string {
  const lines = [
    `# ${artifact.deployment} Macro Eval Report`,
    '',
    `Created: ${artifact.createdAt}`,
    `Traces analyzed: ${artifact.source.traceCount}`,
    `Lower-level eval status: ${artifact.source.evalStatus ?? 'not available'}`,
    `Behavior patterns: ${artifact.patterns.length}`,
    '',
    '## Lower-Level Summary',
    '',
    `- Eval cases: ${artifact.lowerLevelSummary.evalCases}`,
    `- Eval failures: ${artifact.lowerLevelSummary.evalFailures}`,
    `- Run outcomes: ${formatCounts(artifact.lowerLevelSummary.runOutcomes) || 'none'}`,
    `- Case types: ${formatCounts(artifact.lowerLevelSummary.caseTypes) || 'none'}`,
    '',
    '## Behavior Patterns',
    '',
    '| Pattern | Severity | Frequency | Impact | Representative Trace | Inspect |',
    '| --- | --- | ---: | ---: | --- | --- |',
    ...artifact.patterns.map((pattern) => [
      escapeMarkdown(pattern.behaviorPattern),
      pattern.severity,
      String(pattern.frequency),
      String(pattern.impactScore),
      pattern.representativeTraceId,
      escapeMarkdown(pattern.recommendedInspection),
    ].join(' | ')).map((row) => `| ${row} |`),
  ];

  if (artifact.focusPattern) {
    lines.push(
      '',
      '## Focus Pattern',
      '',
      `Pattern: ${artifact.focusPattern.behaviorPattern}`,
      `Summary: ${artifact.focusPattern.summary}`,
      `Affected traces: ${artifact.focusPattern.affectedTraceIds.join(', ')}`,
      `Top tools: ${formatCounts(artifact.focusPattern.topTools) || 'none'}`,
      `Top policies: ${formatCounts(artifact.focusPattern.topPolicies) || 'none'}`,
      '',
      'Recommended next step:',
      artifact.focusPattern.recommendedInspection,
    );
  }

  lines.push(
    '',
    '## Compact Trace Documents',
    '',
    ...artifact.traceDocuments.flatMap((document) => [
      `### ${document.traceId}`,
      '',
      '```text',
      document.compactDocument,
      '```',
      '',
    ]),
  );

  return `${lines.join('\n')}\n`;
}
