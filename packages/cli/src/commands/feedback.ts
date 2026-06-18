import * as path from 'path';
import {
  createArtifactStore,
  loadDeployment,
  readApprovals,
  readAuditLog,
  readJsonArtifacts,
  requireConfigFile,
  writeJsonArtifact,
  type ApprovalArtifact,
  type AuditLogEntry,
  type TraceArtifact,
} from '@fdekit/runtime';
import type { CommandContext } from '../context.js';
import { CliUserError } from '../errors.js';

const FEEDBACK_USAGE = 'fdekit feedback export [--json]';

interface FeedbackExportArtifact {
  id: string;
  createdAt: string;
  deployment: string;
  source: {
    approvals: number;
    auditEvents: number;
    decidedApprovals: number;
    replayableCases: number;
    skippedApprovals: number;
  };
  cases: FeedbackEvalCase[];
  auditFeedback: FeedbackAuditEvent[];
}

interface FeedbackEvalCase {
  name: string;
  input: Record<string, unknown>;
  expected: {
    toolName: string;
    humanDecision: 'approved' | 'rejected';
    shouldProceed: boolean;
  };
  metadata: {
    source: 'approval';
    approvalId: string;
    deployment: string;
    environment?: string;
    agent: string;
    traceId: string;
    runId: string;
    policy: string;
    toolName: string;
    args: unknown;
    reason: string;
    humanDecision: 'approved' | 'rejected';
    decisionReason?: string;
    decidedBy?: string;
    decidedAt?: string;
    inputSource: 'trace' | 'audit';
  };
}

interface FeedbackAuditEvent {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  outcome: string;
  toolName?: string;
  policy?: string;
  approvalId?: string;
  message?: string;
  traceId?: string;
}

export async function cmdFeedback(ctx: CommandContext): Promise<void> {
  const subcommand = ctx.args[0] ?? 'export';

  if (subcommand !== 'export') {
    console.error(`Usage: ${FEEDBACK_USAGE}`);
    process.exitCode = 1;
    return;
  }

  const json = ctx.args.includes('--json');
  const unknown = ctx.args.slice(1).filter((arg) => arg !== '--json');

  if (unknown.length > 0) {
    throw new CliUserError(`Unknown feedback option: ${unknown[0]}`, { usage: FEEDBACK_USAGE });
  }

  const configPath = await requireConfigFile(ctx.cwd);
  const projectDir = path.dirname(configPath);
  const deployment = await loadDeployment(configPath);
  const artifactStore = createArtifactStore({ deployment, projectDir });
  const approvals = await readApprovals(projectDir, artifactStore);
  const auditLog = await readAuditLog(projectDir, artifactStore);
  const traces = await readJsonArtifacts<TraceArtifact>(projectDir, 'traces', artifactStore);
  const artifact = createFeedbackExport({
    deploymentName: deployment.name,
    approvals,
    auditLog,
    traces,
  });
  const artifactPath = await writeJsonArtifact(projectDir, 'feedback', 'eval-candidates.json', artifact, artifactStore);
  const casesPath = await writeJsonArtifact(projectDir, 'feedback', 'eval-cases.json', artifact.cases, artifactStore);

  if (json) {
    console.log(JSON.stringify({
      artifactPath,
      casesPath,
      artifact,
    }, null, 2));
    return;
  }

  console.log('FDEKit feedback export');
  console.log(`Deployment: ${deployment.name}`);
  console.log(`Feedback candidates: ${artifact.cases.length}`);
  console.log(`Decided approvals: ${artifact.source.decidedApprovals}/${artifact.source.approvals}`);
  if (artifact.source.skippedApprovals > 0) {
    console.log(`Skipped approvals without run input: ${artifact.source.skippedApprovals}`);
  }
  console.log(`Audit feedback events: ${artifact.auditFeedback.length}`);
  console.log(`Artifact: ${artifactPath}`);
  console.log(`Eval cases: ${casesPath}`);
}

function createFeedbackExport(input: {
  deploymentName: string;
  approvals: ApprovalArtifact[];
  auditLog: AuditLogEntry[];
  traces: TraceArtifact[];
}): FeedbackExportArtifact {
  const decidedApprovals = input.approvals.filter((approval) => approval.status === 'approved' || approval.status === 'rejected');
  const replayableCases = decidedApprovals.flatMap((approval) => {
    const runInput = findRunInput(approval, input.traces, input.auditLog);

    return runInput ? [approvalToEvalCase(approval, runInput)] : [];
  });
  const auditFeedback = input.auditLog
    .filter((entry) => entry.action.startsWith('approval.') || entry.actor !== 'agent')
    .map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      actor: entry.actor,
      action: entry.action,
      outcome: entry.outcome,
      toolName: entry.toolName,
      policy: entry.policy,
      approvalId: entry.approvalId,
      message: entry.message,
      traceId: entry.traceId,
    }));

  return {
    id: `feedback_${new Date().toISOString().replace(/[:.]/g, '-')}`,
    createdAt: new Date().toISOString(),
    deployment: input.deploymentName,
    source: {
      approvals: input.approvals.length,
      auditEvents: input.auditLog.length,
      decidedApprovals: decidedApprovals.length,
      replayableCases: replayableCases.length,
      skippedApprovals: decidedApprovals.length - replayableCases.length,
    },
    cases: replayableCases,
    auditFeedback,
  };
}

function approvalToEvalCase(
  approval: ApprovalArtifact,
  runInput: { value: Record<string, unknown>; source: 'trace' | 'audit' },
): FeedbackEvalCase {
  const humanDecision = approval.status as 'approved' | 'rejected';

  return {
    name: `${humanDecision} ${approval.toolName} ${approval.id}`,
    input: runInput.value,
    expected: {
      toolName: approval.toolName,
      humanDecision,
      shouldProceed: humanDecision === 'approved',
    },
    metadata: {
      source: 'approval',
      approvalId: approval.id,
      deployment: approval.deployment,
      environment: approval.environment,
      agent: approval.agent,
      traceId: approval.traceId,
      runId: approval.runId,
      policy: approval.policy,
      toolName: approval.toolName,
      args: approval.args,
      reason: approval.reason,
      humanDecision,
      decisionReason: approval.decisionReason,
      decidedBy: approval.decidedBy,
      decidedAt: approval.decidedAt,
      inputSource: runInput.source,
    },
  };
}

function findRunInput(
  approval: ApprovalArtifact,
  traces: TraceArtifact[],
  auditLog: AuditLogEntry[],
): { value: Record<string, unknown>; source: 'trace' | 'audit' } | undefined {
  const trace = traces.find((candidate) => candidate.id === approval.traceId);
  const traceStart = trace?.events.find((event) => event.type === 'agent.run.started');
  const traceInput = asRecord(traceStart?.input);

  if (traceInput) {
    return { value: traceInput, source: 'trace' };
  }

  const auditStart = auditLog.find((entry) => (
    entry.action === 'agent.run.started'
    && (entry.traceId === approval.traceId || entry.runId === approval.runId)
  ));
  const auditInput = asRecord(auditStart?.metadata?.input);

  return auditInput ? { value: auditInput, source: 'audit' } : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
