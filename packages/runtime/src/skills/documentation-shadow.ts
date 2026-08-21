import { promises as fs } from 'node:fs';
import {
  evaluateProjectSkillGrant,
  isSafeRepositoryPath,
  type EffectivePolicy,
  type ProjectSkillExecutionMode,
  type ProjectSkillGrant,
} from '@fdekit/core';
import type { ExecutionBackend, ExecutionCommandResult } from '../execution/index.js';
import type { LoadedProjectSkill } from './index.js';

export interface DocumentationSkillDocument {
  path: string;
  content: string;
  sourceId: string;
}

export interface DocumentationSkillOutput {
  summary: string;
  findings: Array<{
    code: string;
    message: string;
    path?: string;
    severity: 'info' | 'warning' | 'error';
  }>;
  proposedChanges: Array<{
    path: string;
    content: string;
    reason: string;
  }>;
  validations: Array<{
    name: string;
    status: 'passed' | 'failed' | 'not_run';
    message?: string;
  }>;
}

export interface RunDocumentationSkillShadowOptions {
  skill: LoadedProjectSkill;
  policy: EffectivePolicy;
  backend: ExecutionBackend;
  executable: string;
  documents: DocumentationSkillDocument[];
  objective: string;
  mode?: Extract<ProjectSkillExecutionMode, 'diff_only' | 'shadow'>;
  timeoutMs?: number;
}

export interface DocumentationSkillShadowResult {
  schemaVersion: 1;
  skill: { name: string; version: string; digest: string };
  mode: 'diff_only' | 'shadow';
  policyFingerprint: string;
  grant: ProjectSkillGrant;
  output: DocumentationSkillOutput;
  execution: Pick<ExecutionCommandResult, 'status' | 'exitCode' | 'durationMs' | 'startedAt' | 'completedAt'>;
  publishAttempted: false;
}

/**
 * Execute the documentation pilot in an isolated, network-disabled disposable
 * workspace. Only validated stdout proposals are returned; workspace changes
 * are destroyed and there is no apply/publish path.
 */
export async function runDocumentationSkillShadow(
  options: RunDocumentationSkillShadowOptions,
): Promise<DocumentationSkillShadowResult> {
  const mode = options.mode ?? 'shadow';
  if (mode !== 'diff_only' && mode !== 'shadow') {
    throw new Error('Documentation skill pilot supports only diff_only or shadow mode');
  }
  const grant = evaluateProjectSkillGrant(options.skill.manifest, mode, options.policy);
  if (grant.decision !== 'allow') {
    throw new Error(
      `Documentation skill ${options.skill.manifest.name} is ${grant.decision}: `
      + (grant.reasons.join(' ') || 'effective policy did not grant execution'),
    );
  }
  assertIsolatedBackend(options.backend);
  if (typeof options.objective !== 'string' || !options.objective.trim()) {
    throw new Error('Documentation skill objective is required');
  }
  if (!Array.isArray(options.documents)) throw new Error('Documentation skill documents must be an array');
  for (const document of options.documents) {
    if (
      typeof document.path !== 'string'
      || typeof document.content !== 'string'
      || typeof document.sourceId !== 'string'
      || !isSafeRepositoryPath(document.path)
    ) {
      throw new Error(`Documentation input path "${document.path}" is unsafe`);
    }
    if (!grant.grantedSourceIds.includes(document.sourceId)) {
      throw new Error(`Documentation input source "${document.sourceId}" is not granted`);
    }
  }
  const estimatedInputTokens = Math.ceil(
    (options.objective.length + options.documents.reduce((sum, document) => sum + document.content.length, 0)) / 4,
  );
  if (estimatedInputTokens > options.policy.budget.maxInputTokens) {
    throw new Error(
      `Documentation skill input budget exceeded: ${estimatedInputTokens} estimated tokens, `
      + `limit ${options.policy.budget.maxInputTokens}`,
    );
  }

  const entrypoint = await fs.readFile(options.skill.entrypoint, 'utf8');
  const timeoutMs = boundedTimeout(options);
  const lease = await options.backend.acquire({
    leaseId: `skill-${safeLeasePart(options.skill.manifest.name)}-${Date.now()}`,
    ttlMs: timeoutMs + 1_000,
    files: [{ path: 'skill-entrypoint.mjs', content: entrypoint }],
    requirements: {
      filesystemIsolation: true,
      processIsolation: true,
      networkIsolation: true,
    },
    metadata: {
      skill: options.skill.manifest.name,
      version: options.skill.manifest.version,
      mode,
      policyFingerprint: options.policy.fingerprint,
    },
  });

  try {
    const execution = await lease.execute({
      executable: options.executable,
      args: ['skill-entrypoint.mjs'],
      stdin: JSON.stringify({
        schemaVersion: 1,
        objective: options.objective,
        mode,
        documents: options.documents,
      }),
      timeoutMs,
    });
    if (execution.status !== 'completed') {
      throw new Error(
        `Documentation skill execution ${execution.status}`
        + (execution.stderr ? `: ${execution.stderr}` : ''),
      );
    }
    const output = parseDocumentationOutput(execution.stdout);
    return {
      schemaVersion: 1,
      skill: {
        name: options.skill.manifest.name,
        version: options.skill.manifest.version,
        digest: options.skill.manifest.provenance.digest,
      },
      mode,
      policyFingerprint: options.policy.fingerprint,
      grant,
      output,
      execution: {
        status: execution.status,
        exitCode: execution.exitCode,
        durationMs: execution.durationMs,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
      },
      publishAttempted: false,
    };
  } finally {
    await lease.release();
  }
}

function assertIsolatedBackend(backend: ExecutionBackend): void {
  const missing = (['filesystemIsolation', 'processIsolation', 'networkIsolation'] as const)
    .filter((capability) => !backend.capabilities[capability]);
  if (missing.length > 0) {
    throw new Error(
      `Documentation shadow skill requires an isolated backend; ${backend.name} lacks ${missing.join(', ')}`,
    );
  }
}

function boundedTimeout(options: RunDocumentationSkillShadowOptions): number {
  const requested = options.timeoutMs ?? 30_000;
  if (!Number.isInteger(requested) || requested <= 0) {
    throw new Error('Documentation skill timeoutMs must be a positive integer');
  }
  return Math.min(
    requested,
    options.policy.budget.maxLatencyMs ?? requested,
    options.policy.budget.maxDurationMs ?? requested,
  );
}

function parseDocumentationOutput(stdout: string): DocumentationSkillOutput {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    throw new Error('Documentation skill stdout must be one JSON object');
  }
  if (!isRecord(value) || typeof value.summary !== 'string') {
    throw new Error('Documentation skill output requires a summary');
  }
  if (!Array.isArray(value.findings) || !Array.isArray(value.proposedChanges) || !Array.isArray(value.validations)) {
    throw new Error('Documentation skill output requires findings, proposedChanges, and validations arrays');
  }
  for (const change of value.proposedChanges) {
    if (
      !isRecord(change)
      || typeof change.path !== 'string'
      || !isSafeRepositoryPath(change.path)
      || typeof change.content !== 'string'
      || typeof change.reason !== 'string'
    ) {
      throw new Error('Documentation skill proposed changes must contain safe path, content, and reason strings');
    }
  }
  for (const finding of value.findings) {
    if (
      !isRecord(finding)
      || typeof finding.code !== 'string'
      || typeof finding.message !== 'string'
      || !['info', 'warning', 'error'].includes(String(finding.severity))
      || (finding.path !== undefined && (
        typeof finding.path !== 'string' || !isSafeRepositoryPath(finding.path)
      ))
    ) {
      throw new Error('Documentation skill findings must contain code, message, severity, and an optional safe path');
    }
  }
  for (const validation of value.validations) {
    if (
      !isRecord(validation)
      || typeof validation.name !== 'string'
      || !['passed', 'failed', 'not_run'].includes(String(validation.status))
      || (validation.message !== undefined && typeof validation.message !== 'string')
    ) {
      throw new Error('Documentation skill validations must contain name, status, and an optional message');
    }
  }
  return value as unknown as DocumentationSkillOutput;
}

function safeLeasePart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 64) || 'documentation';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
