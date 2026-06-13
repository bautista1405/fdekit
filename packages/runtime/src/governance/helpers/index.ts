import * as path from 'path';
import type { ArtifactStore } from '../../artifact-store/index.js';
import { readJsonArtifact, writeJsonArtifact } from '../../artifact-store/index.js';
import type { ApprovalArtifact } from '../interfaces/index.js';

const SENSITIVE_KEY_PATTERN = /(?:api[_-]?key|authorization|cookie|password|secret|token)/i;
const SENSITIVE_VALUE_PATTERNS = [
  /\b(?:sk|pk)-[A-Za-z0-9_\-]{16,}\b/g,
  /\b[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{6,}\.[A-Za-z0-9_\-]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9_\-./+=]{12,}\b/gi,
];

export async function writeApproval(
  projectDir: string,
  approval: ApprovalArtifact,
  artifactStore?: ArtifactStore,
): Promise<void> {
  await writeJsonArtifact(projectDir, 'approvals', `${approval.id}.json`, approval, artifactStore);
}

export async function readApprovalArtifact(
  projectDir: string,
  id: string,
  artifactStore?: ArtifactStore,
): Promise<ApprovalArtifact | null> {
  return readJsonArtifact<ApprovalArtifact>(projectDir, 'approvals', `${id}.json`, artifactStore);
}

export function approvalsDir(projectDir: string): string {
  return path.join(projectDir, '.fdekit', 'approvals');
}

export function auditDir(projectDir: string): string {
  return path.join(projectDir, '.fdekit', 'audit');
}

export function approvalIdFromFingerprint(fingerprint: string): string {
  return `appr_${fingerprint.slice(0, 20)}`;
}

export function createAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function redactForGovernance(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactForGovernance);
  }

  if (typeof value === 'string') {
    return SENSITIVE_VALUE_PATTERNS.reduce(
      (current, pattern) => current.replace(pattern, '[REDACTED]'),
      value,
    );
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const redacted: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    redacted[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? '[REDACTED]'
      : redactForGovernance(nested);
  }

  return redacted;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortForStableStringify(value));
}

function sortForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableStringify);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => [key, sortForStableStringify(nested)]));
}
