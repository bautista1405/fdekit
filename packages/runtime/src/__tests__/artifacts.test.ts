import { mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import type { S3ArtifactStoreDefinition } from '@fdekit/core';
import {
  createArtifactStore,
  createFileArtifactStore,
  createS3ArtifactStore,
  readJsonArtifacts,
  readJsonArtifact,
  readJsonlArtifact,
  writeJsonArtifact,
  writeTextArtifact,
  appendJsonlArtifact,
  type S3ArtifactClient,
  type S3GetObjectInput,
  type S3GetObjectOutput,
  type S3ListObjectsV2Input,
  type S3ListObjectsV2Output,
  type S3PutObjectInput,
} from '../artifact-store/index.js';

describe('artifact stores', () => {
  it('keeps artifacts as the default local artifact root', async () => {
    const projectDir = await mkArtifactProjectDir();
    const store = createArtifactStore({ projectDir });
    const uri = await writeJsonArtifact(projectDir, 'traces', 'trace.json', { id: 'trace_1' }, store);

    expect(uri).toBe(path.join(projectDir, 'artifacts', 'traces', 'trace.json'));
    expect(await readJsonArtifact(projectDir, 'traces', 'trace.json', store)).toEqual({ id: 'trace_1' });
    expect(await readJsonArtifacts(projectDir, 'traces', store)).toEqual([{ id: 'trace_1' }]);
    await expect(readFile(uri, 'utf8')).resolves.toContain('"trace_1"');
  });

  it('supports a custom local artifact root without changing helper call sites', async () => {
    const projectDir = await mkArtifactProjectDir();
    const store = createFileArtifactStore({ projectDir, rootDir: 'custom-artifacts' });
    const uri = await writeTextArtifact(projectDir, 'reports', 'deployment-report.md', 'hello', store);

    expect(uri).toBe(path.join(projectDir, 'custom-artifacts', 'reports', 'deployment-report.md'));
  });

  it('uses artifacts as the default S3 prefix', async () => {
    const projectDir = await mkArtifactProjectDir();
    const client = new MemoryS3Client();
    const store = createS3ArtifactStore({
      bucket: 'fdekit-artifacts',
      client,
    });

    expect(await writeJsonArtifact(projectDir, 'traces', 'trace.json', { id: 'trace_1' }, store))
      .toBe('s3://fdekit-artifacts/artifacts/traces/trace.json');
  });

  it('rejects untyped S3 definitions without a client at runtime', () => {
    const artifacts = {
      kind: 's3',
      bucket: 'fdekit-artifacts',
    } as unknown as S3ArtifactStoreDefinition;

    expect(() => createArtifactStore({
      projectDir: '/tmp/fdekit-s3-missing-client',
      deployment: {
        name: 'missing-s3-client',
        providers: {},
        agents: {},
        artifacts,
      },
    })).toThrow(
      'S3 artifact store requires a client with putObject, getObject, and listObjectsV2 methods',
    );
  });

  it('writes, lists, and appends S3 artifacts through an adapter client', async () => {
    const projectDir = await mkArtifactProjectDir();
    const client = new MemoryS3Client();
    const store = createS3ArtifactStore({
      bucket: 'fdekit-artifacts',
      prefix: 'teams/support',
      client,
    });

    const traceUri = await writeJsonArtifact(projectDir, 'traces', 'trace.json', { id: 'trace_1' }, store);
    await appendJsonlArtifact(projectDir, 'audit', 'audit.jsonl', { id: 'audit_1' }, store);
    await appendJsonlArtifact(projectDir, 'audit', 'audit.jsonl', { id: 'audit_2' }, store);

    expect(traceUri).toBe('s3://fdekit-artifacts/teams/support/traces/trace.json');
    expect(await readJsonArtifact(projectDir, 'traces', 'trace.json', store)).toEqual({ id: 'trace_1' });
    expect(await readJsonArtifacts(projectDir, 'traces', store)).toEqual([{ id: 'trace_1' }]);
    expect(await readJsonlArtifact(projectDir, 'audit', 'audit.jsonl', store)).toEqual([
      { id: 'audit_1' },
      { id: 'audit_2' },
    ]);
    expect(client.keys()).toEqual([
      'teams/support/audit/audit.jsonl',
      'teams/support/traces/trace.json',
    ]);
  });
});

class MemoryS3Client implements S3ArtifactClient {
  private readonly objects = new Map<string, string>();

  async putObject(input: S3PutObjectInput): Promise<void> {
    this.objects.set(input.Key, String(input.Body));
  }

  async getObject(input: S3GetObjectInput): Promise<S3GetObjectOutput> {
    const value = this.objects.get(input.Key);

    if (value === undefined) {
      const err = new Error('No such key') as Error & { name: string };
      err.name = 'NoSuchKey';
      throw err;
    }

    return { Body: value };
  }

  async listObjectsV2(input: S3ListObjectsV2Input): Promise<S3ListObjectsV2Output> {
    return {
      Contents: this.keys()
        .filter((key) => key.startsWith(input.Prefix))
        .map((Key) => ({ Key })),
    };
  }

  keys(): string[] {
    return [...this.objects.keys()].sort();
  }
}

async function mkArtifactProjectDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'fdekit-artifacts-'));
}
