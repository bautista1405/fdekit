import { getString } from '@fdekit/core';
import type { ConsoleMetrics } from '../../interfaces/index.js';
import {
  collectFieldMethod,
  collectHarness,
} from '../field-method.js';
import {
  calculateReadinessScore,
  createBusinessImpact,
  createIntegrationReadiness,
  createProductionReadiness,
  createReadinessSignals,
  createReusablePatterns,
  createWorkflowMap,
} from '../readiness.js';
import type { MetricsContext } from './context.js';
import type { EvalMetrics } from './evals.js';
import type { EvidenceMetrics } from './evidence.js';
import type { GovernanceMetrics } from './governance.js';
import type { ToolMetrics } from './tools.js';

type ReadinessMetrics = Pick<
  ConsoleMetrics,
  | 'readinessScore'
  | 'readinessSignals'
  | 'fieldMethod'
  | 'harness'
  | 'businessImpact'
  | 'integrationReadiness'
  | 'workflowMap'
  | 'productionReadiness'
  | 'reusablePatterns'
>;

export function collectReadinessMetrics(input: {
  context: MetricsContext;
  evalMetrics: EvalMetrics;
  evidenceMetrics: EvidenceMetrics;
  governanceMetrics: GovernanceMetrics;
  toolMetrics: ToolMetrics;
}): ReadinessMetrics {
  const {
    context,
    evalMetrics,
    evidenceMetrics,
    governanceMetrics,
    toolMetrics,
  } = input;
  const customerSystemEvidenceCount = Math.max(
    evidenceMetrics.createdIssues.length + evidenceMetrics.slackMessages.length,
    evidenceMetrics.connectorEvidence.length,
  );
  const readinessSignals = createReadinessSignals({
    evalStatus: context.evalStatus,
    evalCaseCount: context.evalCases.length,
    evalPassedCases: context.evalPassedCases,
    traceCount: context.traces.length,
    externalActionCount: customerSystemEvidenceCount,
    policyEvaluations: governanceMetrics.policyEvaluations,
    policyViolationCount: context.latestPolicyViolationCount,
    approvalQueueCount: governanceMetrics.openApprovalCount,
    reportReady: context.reportReady,
  });

  return {
    readinessScore: calculateReadinessScore(readinessSignals),
    readinessSignals,
    fieldMethod: collectFieldMethod(context.data.deployment),
    harness: collectHarness(context.data.deployment),
    businessImpact: createBusinessImpact({
      deployment: context.data.deployment,
      traceCount: context.traces.length,
      toolCallCount: toolMetrics.toolCallCount,
      externalActionCount: evidenceMetrics.createdIssues.length + evidenceMetrics.slackMessages.length,
      connectorEvidence: evidenceMetrics.connectorEvidence,
      evalCaseCount: context.evalCases.length,
      evalPassedCases: context.evalPassedCases,
      evalStatus: context.evalStatus,
      reportReady: context.reportReady,
    }),
    integrationReadiness: createIntegrationReadiness(context.data.deployment, evidenceMetrics.connectorEvidence),
    workflowMap: createWorkflowMap({
      latestTrace: evidenceMetrics.latestTrace,
      evalStatus: context.evalStatus,
      policyEventCount: governanceMetrics.policyEvents.length,
      approvalQueueCount: governanceMetrics.openApprovalCount,
      finalAnswer: getString(context.latestRunSummary.message) ?? null,
    }),
    productionReadiness: createProductionReadiness({
      evalStatus: context.evalStatus,
      policyViolationCount: context.latestPolicyViolationCount,
      approvalQueueCount: governanceMetrics.openApprovalCount,
      governancePosture: governanceMetrics.governancePosture,
      budgetCaps: governanceMetrics.budgetCaps,
      totalCostUsd: toolMetrics.totalCostUsd,
      auditLog: governanceMetrics.auditLog,
      snapshotTrend: evalMetrics.snapshotTrend,
      reportReady: context.reportReady,
    }),
    reusablePatterns: createReusablePatterns({
      deployment: context.data.deployment,
      connectorEvidence: evidenceMetrics.connectorEvidence,
      history: context.data.history ?? [],
    }),
  };
}
