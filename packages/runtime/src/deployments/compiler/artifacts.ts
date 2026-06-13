import * as path from 'path';
import type { ArtifactStoreDefinition } from '@fdekit/core';
import type { CompiledArtifactPaths, CompiledArtifactStorePlan } from '../interfaces/index.js';

const DEFAULT_ARTIFACT_ROOT = '.fdekit';

export function compileArtifactStore(
  definition: ArtifactStoreDefinition | undefined,
  projectDir: string | undefined,
): CompiledArtifactStorePlan {
  if (definition?.kind === 's3') {
    const prefix = normalizeS3Prefix(definition.prefix ?? DEFAULT_ARTIFACT_ROOT);

    return {
      kind: 's3',
      root: `s3://${definition.bucket}${prefix ? `/${prefix}` : ''}`,
      bucket: definition.bucket,
      prefix,
      region: definition.region,
    };
  }

  if (!definition || definition.kind === undefined || definition.kind === 'local') {
    const rootDir = definition?.rootDir ?? DEFAULT_ARTIFACT_ROOT;
    const root = path.isAbsolute(rootDir) || !projectDir
      ? rootDir
      : path.join(projectDir, rootDir);

    return {
      kind: 'local',
      root,
    };
  }

  throw new Error(`Unsupported artifact store: ${(definition as { kind?: string }).kind ?? 'unknown'}`);
}

export function compileArtifactPaths(
  projectDir: string | undefined,
  definition?: ArtifactStoreDefinition,
): CompiledArtifactPaths {
  const store = compileArtifactStore(definition, projectDir);

  return {
    root: store.root,
    traces: joinArtifactPath(store, 'traces'),
    approvals: joinArtifactPath(store, 'approvals'),
    auditLog: joinArtifactPath(store, 'audit', 'audit.jsonl'),
    deploymentsLatest: joinArtifactPath(store, 'deployments', 'latest.json'),
    deploymentSnapshots: joinArtifactPath(store, 'deployments', 'snapshots'),
    executionPlan: joinArtifactPath(store, 'deployments', 'execution-plan.json'),
    evalsLatest: joinArtifactPath(store, 'evals', 'latest.json'),
    macroEvalsLatest: joinArtifactPath(store, 'evals', 'macro', 'latest.json'),
    macroEvalReport: joinArtifactPath(store, 'evals', 'macro', 'report.md'),
    feedbackEvalCandidates: joinArtifactPath(store, 'feedback', 'eval-candidates.json'),
    feedbackEvalCases: joinArtifactPath(store, 'feedback', 'eval-cases.json'),
    report: joinArtifactPath(store, 'reports', 'deployment-report.md'),
    console: joinArtifactPath(store, 'console.html'),
    consoleHistory: joinArtifactPath(store, 'consoles', 'history.json'),
    exports: joinArtifactPath(store, 'exports'),
  };
}

function joinArtifactPath(store: CompiledArtifactStorePlan, ...parts: string[]): string {
  if (store.kind === 's3') {
    return `${store.root}/${parts.map(normalizeS3Prefix).filter(Boolean).join('/')}`;
  }

  return path.join(store.root, ...parts);
}

function normalizeS3Prefix(value: string): string {
  return value
    .split(/[\\/]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/');
}
