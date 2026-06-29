import type { EvalCaseResult } from '@fdekit/runtime';
import type { ConsoleData, ConsoleMetrics } from '../interfaces/index.js';
import { collectGenericConnectorEvidence } from '../view-models/index.js';

export function renderExportDataJson(
  data: ConsoleData,
  metrics: ConsoleMetrics,
  createdAt: string,
  evalCases: EvalCaseResult[],
): string {
  return `${JSON.stringify({
    createdAt,
    deployment: {
      name: data.deployment.name,
      environment: data.deployment.environment ?? 'local',
      providers: Object.keys(data.deployment.providers ?? {}),
      connectors: Object.keys(data.deployment.connectors ?? {}),
      agents: Object.keys(data.deployment.agents ?? {}),
    },
    metrics: {
      traceCount: metrics.traceCount,
      allTraceCount: metrics.allTraceCount,
      traceScope: metrics.traceScope,
      evalStatus: metrics.evalStatus,
      evalCaseCount: metrics.evalCaseCount,
      evalPassedCases: metrics.evalPassedCases,
      readinessScore: metrics.readinessScore,
      healthStatus: metrics.healthStatus,
      totalRunCount: metrics.totalRunCount,
      completedRunCount: metrics.completedRunCount,
      policyBlockedRunCount: metrics.policyBlockedRunCount,
      reliabilityFailureCount: metrics.reliabilityFailureCount,
      successRate: metrics.successRate,
      reliabilityStatus: metrics.reliabilityStatus,
      latencyStatus: metrics.latencyStatus,
      enforcementMode: metrics.enforcementMode,
      policyEvaluations: metrics.policyEvaluations,
      policyViolationCount: metrics.policyViolationCount,
      policyDefinitionCount: metrics.policyDefinitions.length,
      approvalQueueCount: metrics.approvalQueue.length,
      auditEventCount: metrics.auditEventCount,
      toolCallCount: metrics.toolCallCount,
      avgLatencyMs: metrics.avgLatencyMs,
      p95LatencyMs: metrics.p95LatencyMs,
      maxLatencyMs: metrics.maxLatencyMs,
      fleetAvgLatencyMs: metrics.fleetAvgLatencyMs,
      fleetP95LatencyMs: metrics.fleetP95LatencyMs,
      totalCostUsd: metrics.totalCostUsd,
    },
    readinessSignals: metrics.readinessSignals,
    fieldMethod: metrics.fieldMethod,
    harness: metrics.harness,
    businessImpact: metrics.businessImpact,
    workflowMap: metrics.workflowMap,
    integrationReadiness: metrics.integrationReadiness,
    productionReadiness: metrics.productionReadiness,
    reusablePatterns: metrics.reusablePatterns,
    governancePosture: metrics.governancePosture,
    enforcementPosture: metrics.enforcementPosture,
    runs: metrics.runHistory,
    connectorEvidence: collectGenericConnectorEvidence(metrics.connectorEvidence),
    policyDefinitions: metrics.policyDefinitions,
    budgetCaps: metrics.budgetCaps,
    approvalQueue: metrics.approvalQueue,
    auditLog: summarizeAuditLog(metrics.auditLog),
    createdIssues: metrics.createdIssues,
    slackMessages: metrics.slackMessages,
    evalSuites: metrics.evalSuites,
    macroEvalSummary: summarizeMacroEval(data.latestMacroEval ?? null),
    snapshotTrend: metrics.snapshotTrend,
    evalCases: summarizeEvalCases(evalCases),
  }, null, 2)}\n`;
}

function summarizeEvalCases(evalCases: EvalCaseResult[]): unknown[] {
  return evalCases.map((evalCase) => {
    const assertions = evalCase.assertions ?? [];

    return {
      name: evalCase.name,
      status: evalCase.status,
      traceId: evalCase.traceId,
      toolCalls: evalCase.toolCalls ?? [],
      assertionCount: assertions.length,
      passedAssertions: assertions.filter((assertion) => assertion.passed).length,
    };
  });
}

function summarizeAuditLog(entries: ConsoleMetrics['auditLog']): unknown[] {
  return entries.slice(-12).map((entry) => ({
    id: entry.id,
    createdAt: entry.createdAt,
    outcome: entry.outcome,
    action: entry.action,
    actor: entry.actor,
    toolName: entry.toolName,
    policy: entry.policy,
    approvalId: entry.approvalId,
    traceId: entry.traceId ?? entry.runId,
    message: entry.message,
  }));
}

function summarizeMacroEval(macroEval: ConsoleData['latestMacroEval']): unknown {
  if (!macroEval) {
    return null;
  }

  return {
    id: macroEval.id,
    createdAt: macroEval.createdAt,
    source: macroEval.source,
    patternCount: macroEval.patterns.length,
    focusPattern: macroEval.focusPattern
      ? {
        id: macroEval.focusPattern.id,
        behaviorPattern: macroEval.focusPattern.behaviorPattern,
        severity: macroEval.focusPattern.severity,
        frequency: macroEval.focusPattern.frequency,
        impactScore: macroEval.focusPattern.impactScore,
        recommendedInspection: macroEval.focusPattern.recommendedInspection,
      }
      : null,
  };
}
