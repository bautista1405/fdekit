import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ARTIFACT_DELIVERY_PROTOCOL_VERSION,
  ArtifactDeliveryCorruptionError,
  ArtifactDeliveryIdempotencyConflictError,
  ArtifactDeliveryVersionGapError,
  artifactDeliveryId,
  createFileArtifactDeliveryQueue,
  createHttpArtifactDeliveryTarget,
  type ArtifactDeliveryEnvelope,
  type ArtifactDeliveryInput,
  type ArtifactDeliveryTarget,
} from '../artifact-store/index.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('durable artifact delivery', () => {
  it('retains failed deliveries and drains immutable versions in order after restart', async () => {
    const projectDir = await temporaryProject();
    const queue = createFileArtifactDeliveryQueue({ projectDir });
    await queue.enqueue(delivery('review-1', 1, 'first'));
    await queue.enqueue(delivery('review-1', 2, 'second'));

    const unavailable: ArtifactDeliveryTarget = {
      deliver: vi.fn().mockRejectedValue(new Error('network unavailable')),
    };
    const firstFlush = await queue.flush(unavailable);
    expect(firstFlush).toMatchObject({ delivered: [], pending: 2 });
    expect(firstFlush.failures).toEqual([
      expect.objectContaining({ artifactId: 'review-1', version: 1, retryable: true }),
    ]);
    expect(await queue.readAttempts('review-1', 1)).toEqual([
      expect.objectContaining({ outcome: 'failed', message: 'network unavailable' }),
    ]);
    expect(await queue.readAttempts('review-1', 2)).toEqual([]);

    const deliveredVersions: number[] = [];
    const restarted = createFileArtifactDeliveryQueue({ projectDir });
    const accepting: ArtifactDeliveryTarget = {
      async deliver(envelope) {
        deliveredVersions.push(envelope.version);
        return acknowledgement(envelope, 'accepted');
      },
    };
    const resumedFlush = await restarted.flush(accepting);

    expect(deliveredVersions).toEqual([1, 2]);
    expect(resumedFlush).toMatchObject({ failures: [], pending: 0 });
    expect(resumedFlush.delivered.map((receipt) => receipt.version)).toEqual([1, 2]);
    expect(await restarted.readReceipt('review-1', 2)).toMatchObject({
      status: 'accepted',
      checksum: expect.stringMatching(/^sha256:/),
    });
  });

  it('makes retries idempotent and rejects version gaps or conflicting content', async () => {
    const projectDir = await temporaryProject();
    const queue = createFileArtifactDeliveryQueue({ projectDir });
    const first = delivery('review-2', 1, 'same');

    const original = await queue.enqueue(first);
    expect(await queue.enqueue(first)).toEqual(original);
    await expect(queue.enqueue({ ...first, contents: 'different' }))
      .rejects.toBeInstanceOf(ArtifactDeliveryIdempotencyConflictError);
    await expect(queue.enqueue(delivery('review-2', 3, 'gap')))
      .rejects.toBeInstanceOf(ArtifactDeliveryVersionGapError);
  });

  it('isolates partial and out-of-order failures by artifact', async () => {
    const projectDir = await temporaryProject();
    const queue = createFileArtifactDeliveryQueue({ projectDir });
    await queue.enqueue(delivery('artifact-a', 1, 'a1'));
    await queue.enqueue(delivery('artifact-a', 2, 'a2'));
    await queue.enqueue(delivery('artifact-b', 1, 'b1'));

    const target: ArtifactDeliveryTarget = {
      async deliver(envelope) {
        return envelope.artifactId === 'artifact-a'
          ? { ...acknowledgement(envelope, 'out_of_order'), expectedVersion: 1 }
          : acknowledgement(envelope, 'accepted');
      },
    };
    const result = await queue.flush(target);

    expect(result.delivered).toEqual([expect.objectContaining({ artifactId: 'artifact-b' })]);
    expect(result.failures).toEqual([
      expect.objectContaining({ artifactId: 'artifact-a', version: 1, retryable: true }),
    ]);
    expect((await queue.listPending()).map((entry) => `${entry.artifactId}@${entry.version}`)).toEqual([
      'artifact-a@1',
      'artifact-a@2',
    ]);
  });

  it('detects spool tampering instead of silently delivering changed evidence', async () => {
    const projectDir = await temporaryProject();
    const queue = createFileArtifactDeliveryQueue({ projectDir });
    const envelope = await queue.enqueue(delivery('review-corrupt', 1, 'original'));
    const key = createHash('sha256').update(envelope.artifactId).digest('hex');
    const filePath = path.join(projectDir, 'artifacts', 'delivery-spool', 'envelopes', key, '1.json');
    const contents = await fs.readFile(filePath, 'utf8');
    await fs.writeFile(filePath, contents.replace('original', 'tampered'), 'utf8');

    await expect(queue.listPending()).rejects.toBeInstanceOf(ArtifactDeliveryCorruptionError);
  });

  it('sends protocol and idempotency identity through the HTTP delivery target', async () => {
    const projectDir = await temporaryProject();
    const queue = createFileArtifactDeliveryQueue({ projectDir });
    const envelope = await queue.enqueue(delivery('review-http', 1, 'payload'));
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as ArtifactDeliveryEnvelope;
      return new Response(JSON.stringify(acknowledgement(body, 'accepted')), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const target = createHttpArtifactDeliveryTarget({
      endpoint: 'https://control.example.test/api/',
      token: 'worker-token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(await target.deliver(envelope)).toMatchObject({ status: 'accepted', version: 1 });
    expect(artifactDeliveryId('reviews', 'review-http.json')).toMatch(/^artifact:[a-f0-9]{64}$/);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://control.example.test/api/artifact-deliveries',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer worker-token',
          'idempotency-key': 'review-http:1',
          'x-fdekit-artifact-protocol': '1',
        }),
      }),
    );
  });
});

function delivery(artifactId: string, version: number, contents: string): ArtifactDeliveryInput {
  return {
    artifactId,
    version,
    idempotencyKey: `${artifactId}:${version}`,
    group: 'reviews',
    fileName: `${artifactId}.json`,
    operation: 'put',
    encoding: 'json',
    contentType: 'application/json',
    contents,
    producer: { name: '@fdekit/runtime', version: '0.6.0', schemaVersion: 'review.v1' },
    createdAt: '2026-08-19T12:00:00.000Z',
  };
}

function acknowledgement(
  envelope: ArtifactDeliveryEnvelope,
  status: 'accepted' | 'duplicate' | 'out_of_order',
) {
  return {
    protocolVersion: ARTIFACT_DELIVERY_PROTOCOL_VERSION,
    artifactId: envelope.artifactId,
    version: envelope.version,
    checksum: envelope.checksum,
    status,
    deliveredAt: '2026-08-19T12:01:00.000Z',
  } as const;
}

async function temporaryProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'fdekit-delivery-'));
  temporaryDirectories.push(dir);
  return dir;
}
