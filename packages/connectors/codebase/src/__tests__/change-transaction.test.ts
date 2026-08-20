import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { afterEach, describe, expect, it } from 'vitest';
import type { RepositoryChangeSet } from '@fdekit/core';
import { createGitRepositoryOperations } from '../index.js';

const run = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('git repository change transaction', () => {
  // These tests execute several real Git processes. Full-workspace runs start
  // every package suite in parallel, so leave enough room for CPU and disk
  // contention while retaining a finite timeout.
  it('validates in shadow mode and atomically publishes all files against the expected old OID', async () => {
    const rootDir = await gitRepository();
    const operations = createGitRepositoryOperations({ rootDir });
    const baseOid = await operations.resolveRef('refs/heads/main');
    const existing = await operations.readFile(baseOid, 'src/existing.txt');
    const changeSet = changes(baseOid, existing?.blobOid as string);
    const publication = {
      ref: 'refs/heads/main',
      expectedOldOid: baseOid,
      message: 'Apply governed multi-file change',
      actor: { id: 'fde-agent', kind: 'service_principal' as const },
    };

    const shadow = await operations.applyChangeSet(changeSet, { shadow: true, publication });
    expect(shadow.status).toBe('validated');
    expect(await operations.resolveRef('refs/heads/main')).toBe(baseOid);
    expect(await fs.readFile(path.join(rootDir, 'src/existing.txt'), 'utf8')).toBe('before\n');
    await expect(fs.access(path.join(rootDir, 'src/created.txt'))).rejects.toThrow();

    const committed = await operations.applyChangeSet(changeSet, { publication });
    expect(committed).toMatchObject({
      status: 'committed',
      baseOid,
      ref: 'refs/heads/main',
      treeOid: expect.any(String),
      commitOid: expect.any(String),
    });
    expect(await operations.resolveRef('refs/heads/main')).toBe(committed.commitOid);
    expect(await operations.readFile(committed.commitOid as string, 'src/existing.txt')).toMatchObject({ content: 'after\n' });
    expect(await operations.readFile(committed.commitOid as string, 'src/created.txt')).toMatchObject({ content: 'created\n' });

    const stale = await operations.applyChangeSet(changeSet, { publication });
    expect(stale.status).toBe('stale');
    expect(await operations.resolveRef('refs/heads/main')).toBe(committed.commitOid);
  }, 30_000);

  it('does not create a transaction when validation fails or a protected fallback is required', async () => {
    const rootDir = await gitRepository();
    const failing = createGitRepositoryOperations({
      rootDir,
      validators: [() => ({ name: 'tests', status: 'failed', message: 'Tests failed.' })],
    });
    const baseOid = await failing.resolveRef('refs/heads/main');
    const existing = await failing.readFile(baseOid, 'src/existing.txt');
    const changeSet = changes(baseOid, existing?.blobOid as string);
    const publication = {
      ref: 'refs/heads/main',
      expectedOldOid: baseOid,
      message: 'Should not publish',
      actor: { id: 'fde-agent', kind: 'service_principal' as const },
    };
    expect(await failing.applyChangeSet(changeSet, { publication })).toMatchObject({
      status: 'validation_failed',
      validation: { evidence: expect.arrayContaining([expect.objectContaining({ name: 'tests', status: 'failed' })]) },
    });
    expect(await failing.resolveRef('refs/heads/main')).toBe(baseOid);

    const protectedOnly = createGitRepositoryOperations({
      rootDir,
      capabilities: { atomicExpectedRefUpdate: false, protectedChangeRequest: true },
    });
    expect(await protectedOnly.applyChangeSet(changeSet, { publication })).toMatchObject({
      status: 'protected_fallback_required',
      ref: 'refs/heads/main',
    });
    expect(await protectedOnly.resolveRef('refs/heads/main')).toBe(baseOid);
  }, 30_000);
});

function changes(baseOid: string, blobOid: string): RepositoryChangeSet {
  return {
    schemaVersion: 1,
    changeSetId: 'change-1',
    repositoryId: 'local-test',
    base: {
      sourceId: 'local-test',
      revision: baseOid,
      ref: 'refs/heads/main',
      observedAt: '2026-08-19T12:00:00.000Z',
    },
    changes: [
      { operation: 'update', path: 'src/existing.txt', content: 'after\n', expectedBlobOid: blobOid },
      { operation: 'create', path: 'src/created.txt', content: 'created\n' },
    ],
    permittedPaths: ['src'],
    createdAt: '2026-08-19T12:01:00.000Z',
  };
}

async function gitRepository(): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'fdekit-change-transaction-'));
  temporaryDirectories.push(root);
  await run('git', ['init', '-b', 'main'], { cwd: root });
  await run('git', ['config', 'user.name', 'Test User'], { cwd: root });
  await run('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'src/existing.txt'), 'before\n', 'utf8');
  await run('git', ['add', 'src/existing.txt'], { cwd: root });
  await run('git', ['commit', '-m', 'initial'], { cwd: root });
  return root;
}
