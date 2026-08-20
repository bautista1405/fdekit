import { describe, expect, it } from 'vitest';
import {
  evaluateProjectSkillGrant,
  isPermittedRepositoryPath,
  isSafeRepositoryPath,
  validateProjectSkillManifest,
  validateRepositoryChangeSet,
  type EffectivePolicy,
  type ProjectSkillManifest,
  type RepositoryChangeSet,
} from '../index.js';

describe('repository transaction and project skill contracts', () => {
  it('rejects unsafe, duplicate, unpermitted, and stale-unsafe file changes', () => {
    const changeSet = repositoryChangeSet();
    changeSet.changes.push(
      { operation: 'create', path: '../escape.ts', content: 'escape' },
      { operation: 'update', path: 'src/existing.ts', content: 'duplicate' },
      { operation: 'create', path: 'docs/outside.md', content: 'outside' },
    );
    const validation = validateRepositoryChangeSet(changeSet);

    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'unsafe_path',
      'duplicate_path',
      'path_not_permitted',
    ]));
    expect(isSafeRepositoryPath('src/nested/file.ts')).toBe(true);
    expect(isSafeRepositoryPath('/absolute')).toBe(false);
    expect(isPermittedRepositoryPath('src/nested/file.ts', ['src'])).toBe(true);
    expect(isPermittedRepositoryPath('scripts/file.ts', ['src'])).toBe(false);
  });

  it('validates skill provenance shape and grants only the policy subset', () => {
    const manifest = projectSkillManifest();
    expect(validateProjectSkillManifest(manifest)).toEqual({ valid: true, issues: [] });
    expect(validateProjectSkillManifest({ ...manifest, entrypoint: '../outside.ts' })).toMatchObject({
      valid: false,
      issues: [expect.objectContaining({ path: 'entrypoint' })],
    });

    const policy = effectivePolicy();
    expect(evaluateProjectSkillGrant(manifest, 'shadow', policy)).toMatchObject({
      decision: 'allow',
      grantedCapabilities: ['source:read', 'tool:execute'],
      grantedSourceIds: ['repo-a'],
    });
    expect(evaluateProjectSkillGrant(manifest, 'apply', policy)).toMatchObject({
      decision: 'deny',
      reasons: expect.arrayContaining(['Skill does not declare apply mode.', 'Apply mode requires external:write.']),
    });
    expect(evaluateProjectSkillGrant(
      { ...manifest, requestedSourceIds: ['repo-secret'] },
      'shadow',
      policy,
    ).decision).toBe('deny');
  });
});

function repositoryChangeSet(): RepositoryChangeSet {
  return {
    schemaVersion: 1,
    changeSetId: 'change-1',
    repositoryId: 'repo-a',
    base: {
      sourceId: 'repo-a',
      revision: 'commit-oid',
      ref: 'refs/heads/main',
      observedAt: '2026-08-19T12:00:00.000Z',
    },
    changes: [{
      operation: 'update',
      path: 'src/existing.ts',
      content: 'updated',
      expectedBlobOid: 'blob-oid',
    }],
    permittedPaths: ['src'],
    createdAt: '2026-08-19T12:01:00.000Z',
  };
}

function projectSkillManifest(): ProjectSkillManifest {
  return {
    schemaVersion: 1,
    name: 'documentation-review',
    version: '1.0.0',
    description: 'Review documentation in shadow mode.',
    license: 'MIT',
    entrypoint: 'index.js',
    executionModes: ['diff_only', 'shadow'],
    requestedCapabilities: ['source:read', 'tool:execute'],
    requestedSourceIds: ['repo-a'],
    tools: ['codebase.readFile'],
    evalRefs: ['documentation-review-heldout'],
    provenance: { source: 'project', digest: 'sha256:entrypoint' },
  };
}

function effectivePolicy(): EffectivePolicy {
  return {
    schemaVersion: 1,
    version: 'policy.v1',
    fingerprint: 'policy-a',
    evaluatedAt: '2026-08-19T12:00:00.000Z',
    decision: 'allow',
    capabilities: ['source:read', 'tool:execute'],
    approvalRequiredFor: [],
    sourceAllowlist: ['repo-a'],
    budget: { maxInputTokens: 1_000 },
    reasons: ['test'],
  };
}
