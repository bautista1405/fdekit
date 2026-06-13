import { createHash } from 'crypto';
import type { ArtifactStore } from '../artifact-store/index.js';
import { appendJsonlArtifact, readJsonArtifacts, readJsonlArtifact } from '../artifact-store/index.js';
import type {
  ApprovalArtifact,
  ApprovalDecisionOptions,
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
  ApprovalRequestInput,
  ApprovalStatus,
  AuditLogEntry,
  AuditLogInput,
  AuditOutcome,
} from './interfaces/index.js';
export { redactForGovernance } from './helpers/index.js';

export function approvalFingerprint(input: Pick<ApprovalRequestInput,
  'deployment' | 'environment' | 'agent' | 'policy' | 'phase' | 'toolName' | 'args'
>): string {
  return createHash('sha256')
    .update(stableStringify({
      deployment: input.deployment,
      environment: input.environment ?? 'local',
      agent: input.agent,
      policy: input.policy,
      phase: input.phase,
      toolName: input.toolName,
      args: redactForGovernance(input.args),
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
    reason: input.reason ?? `Tool call "${input.toolName}" requires approval`,
    requestedBy: input.requestedBy ?? 'agent',
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
  input: Pick<ApprovalRequestInput, 'deployment' | 'environment' | 'agent' | 'policy' | 'phase' | 'toolName' | 'args'>,
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

  const now = new Date().toISOString();
  const next: ApprovalArtifact = {
    ...approval,
    status,
    updatedAt: now,
    decidedAt: now,
    decidedBy: options.actor ?? 'fde',
    decisionReason: options.reason,
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
