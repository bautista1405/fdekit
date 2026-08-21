import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import {
  isSafeRepositoryPath,
  validateRepositoryChangeSet,
  type MaybePromise,
  type RepositoryChangeSet,
  type RepositoryChangeSetValidation,
  type RepositoryOperations,
  type RepositoryProviderCapabilities,
  type RepositoryTransactionOptions,
  type RepositoryTransactionResult,
  type RepositoryValidationEvidence,
} from '@fdekit/core';

export interface GitChangeValidationContext {
  changeSet: RepositoryChangeSet;
  baseOid: string;
  rootDir: string;
}

export type GitChangeValidator = (
  context: GitChangeValidationContext,
) => MaybePromise<RepositoryValidationEvidence>;

export interface GitRepositoryOperationsOptions {
  rootDir: string;
  validators?: GitChangeValidator[];
  maxChanges?: number;
  maxContentBytes?: number;
  capabilities?: Partial<RepositoryProviderCapabilities>;
}

export function createGitRepositoryOperations(
  options: GitRepositoryOperationsOptions,
): RepositoryOperations {
  const rootDir = path.resolve(options.rootDir);
  const capabilities: RepositoryProviderCapabilities = {
    immutableReads: true,
    multiFileTransactions: true,
    atomicExpectedRefUpdate: true,
    protectedChangeRequest: false,
    ...options.capabilities,
  };

  async function assertRepositoryRoot(): Promise<void> {
    const top = await fs.realpath(path.resolve(await git(rootDir, ['rev-parse', '--show-toplevel'])));
    const requested = await fs.realpath(rootDir);
    if (top !== requested) {
      throw new Error(`Git transaction root must be the repository root; received ${rootDir}, repository is ${top}.`);
    }
  }

  async function resolveRef(ref: string): Promise<string> {
    await assertRepositoryRoot();
    return git(rootDir, ['rev-parse', '--verify', `${ref}^{commit}`]);
  }

  async function readFile(objectId: string, filePath: string) {
    await assertRepositoryRoot();
    if (!isSafeRepositoryPath(filePath)) throw new Error(`Unsafe repository path: ${filePath}`);
    let blobOid: string;
    try {
      blobOid = await git(rootDir, ['rev-parse', '--verify', `${objectId}:${filePath}`]);
    } catch {
      return null;
    }
    const content = await git(rootDir, ['show', `${objectId}:${filePath}`], undefined, false);
    return { content, blobOid };
  }

  async function applyChangeSet(
    changeSet: RepositoryChangeSet,
    transactionOptions: RepositoryTransactionOptions = {},
  ): Promise<RepositoryTransactionResult> {
    await assertRepositoryRoot();
    const validation = validateRepositoryChangeSet(changeSet, {
      maxChanges: options.maxChanges,
      maxContentBytes: options.maxContentBytes,
    });
    let baseOid = changeSet.base.revision;
    try {
      baseOid = await resolveRef(changeSet.base.revision);
    } catch {
      validation.issues.push({ code: 'base_not_found', message: `Base revision ${changeSet.base.revision} was not found.` });
    }

    if (validation.issues.length === 0) {
      await validateExpectedBlobs(changeSet, baseOid, readFile, validation);
    }
    if (validation.issues.length === 0) {
      for (const validator of options.validators ?? []) {
        const evidence = await validator({ changeSet, baseOid, rootDir });
        validation.evidence.push(evidence);
        if (evidence.status === 'failed') {
          validation.issues.push({ code: 'validator_failed', message: evidence.message ?? `${evidence.name} failed.` });
        }
      }
    }
    validation.valid = validation.issues.length === 0;

    if (!validation.valid) return result('validation_failed', changeSet, baseOid, validation);
    if (transactionOptions.shadow || !transactionOptions.publication) {
      return result('validated', changeSet, baseOid, validation);
    }

    const publication = transactionOptions.publication;
    if (publication.ref !== changeSet.base.ref || publication.expectedOldOid !== baseOid) {
      validation.issues.push({
        code: 'publication_identity',
        message: 'Publication ref and expected old OID must exactly match the immutable change-set base.',
      });
      validation.valid = false;
      return result('validation_failed', changeSet, baseOid, validation);
    }
    if (
      publication.mode === 'protected_change_request'
      || !capabilities.atomicExpectedRefUpdate
    ) {
      return {
        ...result('protected_fallback_required', changeSet, baseOid, validation),
        ref: publication.ref,
        message: capabilities.protectedChangeRequest
          ? 'Provider requires a protected change-request publication adapter.'
          : 'Provider cannot atomically publish the expected old object ID.',
      };
    }

    const temporaryDir = await fs.mkdtemp(path.join(tmpdir(), 'fdekit-git-transaction-'));
    const indexPath = path.join(temporaryDir, 'index');
    const env = { ...process.env, GIT_INDEX_FILE: indexPath };
    try {
      await git(rootDir, ['read-tree', baseOid], undefined, true, env);
      for (const [index, change] of changeSet.changes.entries()) {
        if (change.operation === 'delete') {
          await git(rootDir, ['update-index', '--remove', '--', change.path], undefined, true, env);
          continue;
        }
        const contentPath = path.join(temporaryDir, `content-${index}`);
        await fs.writeFile(contentPath, change.content as string, 'utf8');
        const blobOid = await git(rootDir, ['hash-object', '-w', contentPath]);
        await git(
          rootDir,
          ['update-index', '--add', '--cacheinfo', change.mode ?? '100644', blobOid, change.path],
          undefined,
          true,
          env,
        );
      }
      const treeOid = await git(rootDir, ['write-tree'], undefined, true, env);
      const actorName = publication.actor.displayName ?? publication.actor.id;
      const actorEmail = `${publication.actor.id.replace(/[^A-Za-z0-9._-]/g, '-') || 'fdekit'}@fdekit.local`;
      const commitOid = await git(
        rootDir,
        ['commit-tree', treeOid, '-p', baseOid],
        `${publication.message}\n`,
        true,
        {
          ...env,
          GIT_AUTHOR_NAME: actorName,
          GIT_AUTHOR_EMAIL: actorEmail,
          GIT_COMMITTER_NAME: actorName,
          GIT_COMMITTER_EMAIL: actorEmail,
        },
      );
      try {
        await git(rootDir, ['update-ref', publication.ref, commitOid, publication.expectedOldOid]);
      } catch (error) {
        return {
          ...result('stale', changeSet, baseOid, validation),
          treeOid,
          commitOid,
          ref: publication.ref,
          message: error instanceof Error ? error.message : String(error),
        };
      }
      return {
        ...result('committed', changeSet, baseOid, validation),
        treeOid,
        commitOid,
        ref: publication.ref,
      };
    } finally {
      await fs.rm(temporaryDir, { recursive: true, force: true });
    }
  }

  return { capabilities: () => ({ ...capabilities }), resolveRef, readFile, applyChangeSet };
}

async function validateExpectedBlobs(
  changeSet: RepositoryChangeSet,
  baseOid: string,
  readFile: RepositoryOperations['readFile'],
  validation: RepositoryChangeSetValidation,
): Promise<void> {
  for (const change of changeSet.changes) {
    const existing = await readFile(baseOid, change.path);
    if (change.operation === 'create' && existing) {
      validation.issues.push({ code: 'path_exists', path: change.path, message: 'Create target already exists at the immutable base.' });
    } else if (change.operation !== 'create' && !existing) {
      validation.issues.push({ code: 'path_missing', path: change.path, message: 'Update/delete target is absent at the immutable base.' });
    } else if (existing && change.expectedBlobOid !== existing.blobOid) {
      validation.issues.push({ code: 'blob_stale', path: change.path, message: `Expected blob ${change.expectedBlobOid}, found ${existing.blobOid}.` });
    }
  }
  validation.evidence.push({
    name: 'immutable-base-and-blob-identity',
    status: validation.issues.length === 0 ? 'passed' : 'failed',
    message: `Validated ${changeSet.changes.length} path(s) against ${baseOid}.`,
  });
}

function result(
  status: RepositoryTransactionResult['status'],
  changeSet: RepositoryChangeSet,
  baseOid: string,
  validation: RepositoryChangeSetValidation,
): RepositoryTransactionResult {
  return { status, changeSetId: changeSet.changeSetId, baseOid, validation };
}

async function git(
  cwd: string,
  args: string[],
  input?: string,
  trim = true,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const output = Buffer.concat(stdout).toString('utf8');
      if (code === 0) resolve(trim ? output.trim() : output);
      else reject(new Error(`git ${args[0] ?? ''} failed: ${Buffer.concat(stderr).toString('utf8').trim() || `exit ${String(code)}`}`));
    });
    child.stdin.end(input);
  });
}
