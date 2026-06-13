export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type AuditOutcome = 'requested' | 'allowed' | 'blocked' | 'succeeded' | 'failed' | 'approved' | 'rejected';

export interface ApprovalArtifact {
  id: string;
  fingerprint: string;
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
  deployment: string;
  environment?: string;
  agent: string;
  runId: string;
  traceId: string;
  policy: string;
  phase: 'beforeToolCall' | 'afterToolCall';
  toolName: string;
  args: unknown;
  reason: string;
  requestedBy: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionReason?: string;
}

export interface ApprovalRequestInput {
  deployment: string;
  environment?: string;
  agent: string;
  runId: string;
  traceId: string;
  policy: string;
  phase: 'beforeToolCall' | 'afterToolCall';
  toolName: string;
  args: unknown;
  reason?: string;
  requestedBy?: string;
}

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  deployment: string;
  environment?: string;
  agent?: string;
  runId?: string;
  traceId?: string;
  actor: string;
  action: string;
  outcome: AuditOutcome;
  toolName?: string;
  policy?: string;
  approvalId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogInput {
  deployment: string;
  environment?: string;
  agent?: string;
  runId?: string;
  traceId?: string;
  actor?: string;
  action: string;
  outcome: AuditOutcome;
  toolName?: string;
  policy?: string;
  approvalId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalDecisionOptions {
  actor?: string;
  reason?: string;
}
