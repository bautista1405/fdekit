import type { DeploymentDefinition, PolicyDefinition } from '@fdekit/core';
import type {
  ApprovalArtifact,
  AuditLogEntry,
  EvalArtifact,
  MacroEvalArtifact,
  TraceArtifact,
} from '@fdekit/runtime';

export interface ConsoleHistoryEntry {
  createdAt: string;
  deployment: string;
  evalStatus: string;
  traceCount: number;
  file: string;
}

export interface ConsoleData {
  deployment: DeploymentDefinition;
  traces: TraceArtifact[];
  latestEval?: EvalArtifact | null;
  latestMacroEval?: MacroEvalArtifact | null;
  reportMarkdown?: string | null;
  approvals?: ApprovalArtifact[];
  auditLog?: AuditLogEntry[];
  createdAt?: string;
  history?: ConsoleHistoryEntry[];
}

export interface ConsoleExportBundle {
  dashboardCsv: string;
  summaryMarkdown: string;
  dataJson: string;
}

export interface ConsolePage {
  fileName: string;
  title: string;
  html: string;
}

export interface ConsoleMetrics {
  traceCount: number;
  allTraceCount: number;
  traceScope: 'latest_eval' | 'all_traces';
  evalStatus: string;
  evalCaseCount: number;
  evalPassedCases: number;
  readinessScore: number;
  readinessSignals: ReadinessSignal[];
  policyEvaluations: number;
  policyViolationCount: number;
  policyDefinitions: PolicyDefinitionItem[];
  governancePosture: GovernancePostureItem[];
  budgetCaps: BudgetCapItem[];
  approvalQueue: ApprovalQueueItem[];
  auditLog: AuditLogEntry[];
  auditEventCount: number;
  policyEvents: PolicyEventItem[];
  toolCallCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  totalCostUsd: number;
  toolCounts: Array<{ name: string; count: number; avgLatencyMs: number }>;
  createdIssues: CreatedIssue[];
  slackMessages: SlackNotification[];
  connectorEvidence: ConnectorEvidence[];
  runHistory: RunHistoryItem[];
  evalSuites: EvalSuiteSummary[];
  snapshotTrend: SnapshotTrendItem[];
  reportReady: boolean;
  latestTrace: TraceArtifact | null;
  latestRunSummary: Record<string, unknown> | null;
  finalAnswer: string | null;
  fieldMethod: FieldMethodSummary;
  harness: HarnessSummary;
  businessImpact: BusinessImpactItem[];
  integrationReadiness: IntegrationReadinessItem[];
  workflowMap: WorkflowStepItem[];
  productionReadiness: ProductionReadinessItem[];
  reusablePatterns: ReusablePatternItem[];
}

export interface ReadinessSignal {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface BusinessImpactItem {
  label: string;
  value: string;
  detail: string;
  status: 'pass' | 'warn' | 'fail';
}

export interface FieldMethodSummary {
  workflowName: string;
  owner: string;
  currentState: string;
  targetState: string;
  baseline: string;
  target: string;
  rolloutStage: string;
  rolloutNext: string;
  scorecard: FieldMethodItem[];
  dataLayers: FieldMethodItem[];
  outcomeMetrics: FieldMethodItem[];
  rolloutStages: string[];
}

export interface HarnessSummary {
  name: string;
  description: string;
  maxSteps: string;
  phaseCount: number;
  phases: FieldMethodItem[];
  references: FieldMethodItem[];
  artifactRefs: string[];
  review: string;
  steer: string;
}

export interface FieldMethodItem {
  label: string;
  value: string;
  detail: string;
  status: 'pass' | 'warn' | 'fail';
}

export interface IntegrationReadinessItem {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface WorkflowStepItem {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface ProductionReadinessItem {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface ReusablePatternItem {
  label: string;
  value: string;
  detail: string;
  status: 'pass' | 'warn' | 'fail';
}

export interface CreatedIssue {
  tracker: string;
  toolName: string;
  id: string;
  title: string;
  mode?: string;
  url?: string;
  destination?: string;
  traceId: string;
  createdAt: string;
}

export interface SlackNotification {
  channel: string;
  text: string;
  mode?: string;
  ticketId?: string;
  ts?: string;
  traceId: string;
  createdAt: string;
}

export interface ConnectorEvidence {
  connector: string;
  toolName: string;
  title: string;
  detail: string;
  mode?: string;
  url?: string;
  traceId: string;
  createdAt: string;
}

export interface ApprovalQueueItem {
  policy: string;
  toolName: string;
  status: 'pending approval' | 'approved' | 'rejected' | 'blocked';
  reason: string;
  traceId: string;
  createdAt: string;
  approvalId?: string;
  decidedBy?: string;
  decisionReason?: string;
}

export interface PolicyEventItem {
  policy: string;
  toolName: string;
  phase?: string;
  allowed: boolean;
  approvalRequired: boolean;
  reason?: string;
  traceId: string;
  createdAt: string;
}

export interface PolicyDefinitionItem {
  scope: string;
  name: string;
  kind: string;
  description: string;
  detail: string;
}

export interface GovernancePostureItem {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface BudgetCapItem {
  scope: string;
  policy: string;
  maxUsd: number;
}

export interface RunHistoryItem {
  traceId: string;
  createdAt: string;
  status: string;
  latencyMs: number;
  costUsd: number;
  toolCalls: string[];
  issueCount: number;
  slackCount: number;
  finalAnswer?: string;
}

export interface EvalSuiteSummary {
  name: string;
  status: string;
  cases: number;
  passed: number;
  failed: number;
}

export interface SnapshotTrendItem {
  createdAt: string;
  evalStatus: string;
  traceCount: number;
  file: string;
}
