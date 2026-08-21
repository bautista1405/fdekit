import { createHash } from 'crypto';
import type { ArtifactStore } from '../artifact-store/index.js';
import { appendJsonlArtifact, readJsonArtifacts, readJsonlArtifact } from '../artifact-store/index.js';
import type {
  ApprovalArtifact,
  ApprovalDecisionOptions,
  ApprovalDecisionRecord,
  ApprovalRequestInput,
  ApprovalStatus,
  AuditLogEntry,
  AuditLogInput,
  AuditOutcome,
} from './interfaces/index.js';
import {
  approvalIdFromFingerprint,
  createAuditId,
  readApprovalArtifact,
  redactForGovernance,
  stableStringify,
  writeApproval,
} from './helpers/index.js';

export type {
  ApprovalArtifact,
  ApprovalDecisionOptions,
  ApprovalDecisionRecord,
  ApprovalRequestInput,
  ApprovalStatus,
  AuditLogEntry,
  AuditLogInput,
  AuditOutcome,
} from './interfaces/index.js';
export { redactForGovernance } from './helpers/index.js';

export function approvalFingerprint(input: Pick<ApprovalRequestInput,
  'deployment' | 'environment' | 'agent' | 'runId' | 'policy' | 'phase' | 'toolName' | 'args' | 'target' | 'supersedesId'
>): string {
  return createHash('sha256')
    .update(stableStringify({
      deployment: input.deployment,
      environment: input.environment ?? 'local',
      agent: input.agent,
      // A human decision authorizes one exact paused run. Identical arguments
      // in a later run require a fresh decision instead of becoming a standing
      // grant (or carrying a previous rejection forward forever).
      runId: input.runId,
      policy: input.policy,
      phase: input.phase,
      toolName: input.toolName,
      args: redactForGovernance(input.args),
      // Approvals are scoped to the execution target: flipping a connector from
      // simulated to live mode (or pointing it at another repo/channel/API) must
      // invalidate previously granted approvals rather than authorize new writes.
      target: input.target && Object.keys(input.target).length > 0
        ? redactForGovernance(input.target)
        : undefined,
      supersedesId: input.supersedesId,
    }))
    .digest('hex');
}

export async function requestApproval(
  projectDir: string,
  input: ApprovalRequestInput,
  artifactStore?: ArtifactStore,
): Promise<ApprovalArtifact> {
  const fingerprint = approvalFingerprint(input);
  const id = approvalIdFromFingerprint(fingerprint);
  const existing = await readApproval(projectDir, id, artifactStore);

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const approval: ApprovalArtifact = {
    id,
    fingerprint,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    deployment: input.deployment,
    environment: input.environment,
    agent: input.agent,
    runId: input.runId,
    traceId: input.traceId,
    policy: input.policy,
    phase: input.phase,
    toolName: input.toolName,
    args: redactForGovernance(input.args),
    target: input.target && Object.keys(input.target).length > 0
      ? redactForGovernance(input.target) as Record<string, unknown>
      : undefined,
    reason: input.reason ?? `Tool call "${input.toolName}" requires approval`,
    requestedBy: input.requestedBy ?? 'agent',
    supersedesId: input.supersedesId,
  };

  await writeApproval(projectDir, approval, artifactStore);
  await appendAuditLog(projectDir, {
    deployment: input.deployment,
    environment: input.environment,
    agent: input.agent,
    runId: input.runId,
    traceId: input.traceId,
    actor: approval.requestedBy,
    action: 'approval.requested',
    outcome: 'requested',
    toolName: input.toolName,
    policy: input.policy,
    approvalId: approval.id,
    message: approval.reason,
    metadata: {
      phase: input.phase,
      args: approval.args,
    },
  }, artifactStore);

  return approval;
}

export async function findApproval(
  projectDir: string,
  input: Pick<ApprovalRequestInput, 'deployment' | 'environment' | 'agent' | 'runId' | 'policy' | 'phase' | 'toolName' | 'args' | 'target'>,
  artifactStore?: ArtifactStore,
): Promise<ApprovalArtifact | null> {
  return readApproval(projectDir, approvalIdFromFingerprint(approvalFingerprint(input)), artifactStore);
}

export async function readApprovals(
  projectDir: string,
  artifactStore?: ArtifactStore,
): Promise<ApprovalArtifact[]> {
  return (await readJsonArtifacts<ApprovalArtifact>(projectDir, 'approvals', artifactStore))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function readApproval(
  projectDir: string,
  id: string,
  artifactStore?: ArtifactStore,
): Promise<ApprovalArtifact | null> {
  return readApprovalArtifact(projectDir, id, artifactStore);
}

export async function approveApproval(
  projectDir: string,
  id: string,
  options: ApprovalDecisionOptions = {},
  artifactStore?: ArtifactStore,
): Promise<ApprovalArtifact> {
  return decideApproval(projectDir, id, 'approved', options, artifactStore);
}

export async function rejectApproval(
  projectDir: string,
  id: string,
  options: ApprovalDecisionOptions = {},
  artifactStore?: ArtifactStore,
): Promise<ApprovalArtifact> {
  return decideApproval(projectDir, id, 'rejected', options, artifactStore);
}

export async function markApprovalExecuted(
  projectDir: string,
  id: string,
  runId: string,
  artifactStore?: ArtifactStore,
): Promise<ApprovalArtifact | null> {
  const approval = await readApproval(projectDir, id, artifactStore);

  if (!approval || approval.status !== 'approved') {
    return approval;
  }

  const next: ApprovalArtifact = {
    ...approval,
    updatedAt: new Date().toISOString(),
    executedAt: new Date().toISOString(),
    executedRunId: runId,
  };

  await writeApproval(projectDir, next, artifactStore);

  return next;
}

export async function supersedeApproval(
  projectDir: string,
  id: string,
  replacementId: string,
  options: { actor: string; reason?: string },
  artifactStore?: ArtifactStore,
): Promise<ApprovalArtifact> {
  const approval = await readApproval(projectDir, id, artifactStore);
  if (!approval) throw new Error(`Approval request not found: ${id}`);
  if (approval.status === 'superseded' && approval.supersededBy === replacementId) return approval;
  if (approval.status !== 'pending') {
    throw new Error(`Only a pending approval can be superseded; ${id} is ${approval.status}`);
  }
  const now = new Date().toISOString();
  const next: ApprovalArtifact = {
    ...approval,
    status: 'superseded',
    updatedAt: now,
    supersededBy: replacementId,
    supersededAt: now,
    supersededByActor: options.actor,
  };
  await writeApproval(projectDir, next, artifactStore);
  await appendAuditLog(projectDir, {
    deployment: next.deployment,
    environment: next.environment,
    agent: next.agent,
    runId: next.runId,
    traceId: next.traceId,
    actor: options.actor,
    action: 'approval.superseded',
    outcome: 'requested',
    toolName: next.toolName,
    policy: next.policy,
    approvalId: next.id,
    message: options.reason,
    metadata: { replacementId },
  }, artifactStore);
  return next;
}

export async function appendAuditLog(
  projectDir: string,
  input: AuditLogInput,
  artifactStore?: ArtifactStore,
): Promise<AuditLogEntry> {
  const entry: AuditLogEntry = {
    id: createAuditId(),
    createdAt: new Date().toISOString(),
    actor: input.actor ?? 'system',
    deployment: input.deployment,
    environment: input.environment,
    agent: input.agent,
    runId: input.runId,
    traceId: input.traceId,
    action: input.action,
    outcome: input.outcome,
    toolName: input.toolName,
    policy: input.policy,
    approvalId: input.approvalId,
    message: input.message,
    metadata: input.metadata ? redactForGovernance(input.metadata) as Record<string, unknown> : undefined,
  };
  await appendJsonlArtifact(projectDir, 'audit', 'audit.jsonl', entry, artifactStore);

  return entry;
}

export async function readAuditLog(
  projectDir: string,
  artifactStore?: ArtifactStore,
): Promise<AuditLogEntry[]> {
  return readJsonlArtifact<AuditLogEntry>(projectDir, 'audit', 'audit.jsonl', artifactStore);
}

export class ApprovalDecisionConflictError extends Error {
  constructor(public readonly approval: ApprovalArtifact, requestedStatus: ApprovalStatus) {
    super(
      `Approval ${approval.id} is already ${approval.status} `
      + `(by ${approval.decidedBy ?? 'unknown'} at ${approval.decidedAt ?? 'unknown time'}); `
      + `pass force to change the decision to ${requestedStatus}`,
    );
    this.name = 'ApprovalDecisionConflictError';
  }
}

async function decideApproval(
  projectDir: string,
  id: string,
  status: 'approved' | 'rejected',
  options: ApprovalDecisionOptions,
  artifactStore?: ArtifactStore,
): Promise<ApprovalArtifact> {
  const approval = await readApproval(projectDir, id, artifactStore);

  if (!approval) {
    throw new Error(`Approval request not found: ${id}`);
  }

  if (approval.status === status) {
    return approval;
  }

  if (approval.status !== 'pending' && !options.force) {
    throw new ApprovalDecisionConflictError(approval, status);
  }

  const now = new Date().toISOString();
  const decision: ApprovalDecisionRecord = {
    status,
    decidedAt: now,
    decidedBy: options.actor ?? 'fde',
    reason: options.reason,
  };
  const next: ApprovalArtifact = {
    ...approval,
    status,
    updatedAt: now,
    decidedAt: now,
    decidedBy: decision.decidedBy,
    decisionReason: options.reason,
    decisions: [...(approval.decisions ?? []), decision],
  };

  await writeApproval(projectDir, next, artifactStore);
  await appendAuditLog(projectDir, {
    deployment: next.deployment,
    environment: next.environment,
    agent: next.agent,
    runId: next.runId,
    traceId: next.traceId,
    actor: next.decidedBy,
    action: `approval.${status}`,
    outcome: status,
    toolName: next.toolName,
    policy: next.policy,
    approvalId: next.id,
    message: next.decisionReason,
  }, artifactStore);

  return next;
}
