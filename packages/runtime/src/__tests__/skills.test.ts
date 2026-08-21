import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { EffectivePolicy } from '@fdekit/core';
import type { ExecutionBackend, WorkspaceLeaseRequest } from '../execution/index.js';
import { createLocalExecutionBackend } from '../execution/index.js';
import {
  ProjectSkillLoadError,
  loadProjectSkills,
  runDocumentationSkillShadow,
} from '../skills/index.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('project-local skill loading', () => {
  it('loads reviewed manifests and verifies entrypoint integrity without executing them', async () => {
    const projectDir = await projectSkill('export default () => "review";\n');
    const loaded = await loadProjectSkills({ projectDir });

    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      digestVerified: true,
      manifest: {
        name: 'documentation-review',
        executionModes: ['diff_only', 'shadow'],
        requestedCapabilities: ['source:read'],
      },
    });
  });

  it('rejects a changed entrypoint until provenance review updates its digest', async () => {
    const projectDir = await projectSkill('export default () => "review";\n');
    await fs.writeFile(
      path.join(projectDir, 'fdekit/skills/documentation-review/index.js'),
      'export default () => "tampered";\n',
      'utf8',
    );

    await expect(loadProjectSkills({ projectDir })).rejects.toBeInstanceOf(ProjectSkillLoadError);
    await expect(loadProjectSkills({ projectDir })).rejects.toThrow('entrypoint digest mismatch');
  });

  it('runs the documentation pilot as a policy-bound isolated shadow proposal', async () => {
    const projectDir = await projectSkill('process.stdout.write("not run by fake backend");\n');
    const [skill] = await loadProjectSkills({ projectDir });
    let acquired: WorkspaceLeaseRequest | undefined;
    let released = false;
    const backend: ExecutionBackend = {
      name: 'isolated-test',
      capabilities: {
        disposableWorkspace: true,
        commandAllowlist: true,
        environmentAllowlist: true,
        wallClockLimit: true,
        outputLimit: true,
        filesystemIsolation: true,
        processIsolation: true,
        networkIsolation: true,
      },
      async acquire(request) {
        acquired = request;
        return {
          leaseId: request.leaseId,
          workspaceDir: '/isolated/workspace',
          acquiredAt: '2026-08-20T12:00:00.000Z',
          expiresAt: '2026-08-20T12:01:00.000Z',
          capabilities: this.capabilities,
          async execute(command) {
            expect(command).toMatchObject({ executable: 'node', args: ['skill-entrypoint.mjs'] });
            expect(JSON.parse(String(command.stdin))).toMatchObject({ mode: 'shadow' });
            return {
              schemaVersion: 1,
              status: 'completed',
              exitCode: 0,
              signal: null,
              stdout: JSON.stringify({
                summary: 'One documentation improvement proposed.',
                findings: [{ code: 'missing-example', message: 'Add an example.', severity: 'warning' }],
                proposedChanges: [{ path: 'README.md', content: '# Improved', reason: 'Clarify setup.' }],
                validations: [{ name: 'links', status: 'passed' }],
              }),
              stderr: '',
              startedAt: '2026-08-20T12:00:00.000Z',
              completedAt: '2026-08-20T12:00:00.010Z',
              durationMs: 10,
            };
          },
          async release() { released = true; },
        };
      },
    };

    const result = await runDocumentationSkillShadow({
      skill: skill!,
      policy: skillPolicy(),
      backend,
      executable: 'node',
      documents: [{ path: 'README.md', content: '# Existing', sourceId: 'repo-a' }],
      objective: 'Improve onboarding documentation.',
    });

    expect(acquired?.requirements).toEqual({
      filesystemIsolation: true,
      processIsolation: true,
      networkIsolation: true,
    });
    expect(result).toMatchObject({
      mode: 'shadow',
      policyFingerprint: 'policy-a',
      publishAttempted: false,
      output: { proposedChanges: [{ path: 'README.md' }] },
    });
    expect(released).toBe(true);
  });

  it('refuses the shadow pilot on a backend without real isolation', async () => {
    const projectDir = await projectSkill('export default {};\n');
    const [skill] = await loadProjectSkills({ projectDir });
    const rootDir = await fs.mkdtemp(path.join(tmpdir(), 'fdekit-skill-local-'));
    temporaryDirectories.push(rootDir);
    const backend = createLocalExecutionBackend({ rootDir, allowedExecutables: [process.execPath] });

    await expect(runDocumentationSkillShadow({
      skill: skill!,
      policy: skillPolicy(),
      backend,
      executable: process.execPath,
      documents: [{ path: 'README.md', content: '# Existing', sourceId: 'repo-a' }],
      objective: 'Review docs.',
    })).rejects.toThrow('requires an isolated backend');
  });
});

function skillPolicy(): EffectivePolicy {
  return {
    schemaVersion: 1,
    version: 'policy.v1',
    fingerprint: 'policy-a',
    evaluatedAt: '2026-08-20T12:00:00.000Z',
    decision: 'allow',
    capabilities: ['source:read'],
    approvalRequiredFor: [],
    sourceAllowlist: ['repo-a'],
    budget: { maxInputTokens: 1_000, maxLatencyMs: 5_000 },
    reasons: ['Test policy'],
  };
}

async function projectSkill(entrypoint: string): Promise<string> {
  const projectDir = await fs.mkdtemp(path.join(tmpdir(), 'fdekit-project-skill-'));
  temporaryDirectories.push(projectDir);
  const skillDir = path.join(projectDir, 'fdekit/skills/documentation-review');
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, 'index.js'), entrypoint, 'utf8');
  const digest = `sha256:${createHash('sha256').update(entrypoint).digest('hex')}`;
  await fs.writeFile(path.join(skillDir, 'skill.json'), JSON.stringify({
    schemaVersion: 1,
    name: 'documentation-review',
    version: '1.0.0',
    description: 'Review docs in a bounded local mode.',
    license: 'MIT',
    entrypoint: 'index.js',
    executionModes: ['diff_only', 'shadow'],
    requestedCapabilities: ['source:read'],
    requestedSourceIds: ['repo-a'],
    tools: ['codebase.readFile'],
    evalRefs: ['docs-heldout'],
    provenance: { source: 'project', digest, reviewedAt: '2026-08-19T12:00:00.000Z' },
  }, null, 2), 'utf8');
  return projectDir;
}
