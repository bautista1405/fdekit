import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { ExecutionIdentity, SourceSnapshot } from '@fdekit/core';

export const ARTIFACT_DELIVERY_PROTOCOL_VERSION = 1 as const;

export interface ArtifactDeliveryProducer {
  name: string;
  version: string;
  schemaVersion?: string;
}

export interface ArtifactDeliveryInput {
  artifactId: string;
  version: number;
  idempotencyKey: string;
  group: string;
  fileName: string;
  operation: 'put' | 'append';
  encoding: 'json' | 'text' | 'jsonl' | 'binary-base64';
  contentType: string;
  contents: string;
  producer: ArtifactDeliveryProducer;
  createdAt: string;
  identity?: Partial<ExecutionIdentity>;
  sourceSnapshots?: SourceSnapshot[];
  metadata?: Record<string, unknown>;
}

export interface ArtifactDeliveryEnvelope extends ArtifactDeliveryInput {
  protocolVersion: typeof ARTIFACT_DELIVERY_PROTOCOL_VERSION;
  checksum: string;
  envelopeDigest: string;
}

export interface ArtifactDeliveryAck {
  protocolVersion: typeof ARTIFACT_DELIVERY_PROTOCOL_VERSION;
  artifactId: string;
  version: number;
  checksum: string;
  status: 'accepted' | 'duplicate' | 'out_of_order';
  deliveredAt: string;
  expectedVersion?: number;
}

export interface ArtifactDeliveryReceipt extends ArtifactDeliveryAck {
  receiptId: string;
  receiptDigest: string;
}

export interface ArtifactDeliveryAttempt {
  attemptId: string;
  artifactId: string;
  version: number;
  attemptedAt: string;
  outcome: 'accepted' | 'duplicate' | 'out_of_order' | 'failed';
  message?: string;
}

export interface ArtifactDeliveryTarget {
  deliver(envelope: ArtifactDeliveryEnvelope): Promise<ArtifactDeliveryAck>;
}

export interface ArtifactDeliveryFailure {
  artifactId: string;
  version: number;
  message: string;
  retryable: boolean;
}

export interface ArtifactDeliveryFlushResult {
  delivered: ArtifactDeliveryReceipt[];
  failures: ArtifactDeliveryFailure[];
  pending: number;
}

export interface FileArtifactDeliveryQueueOptions {
  projectDir: string;
  /** Defaults to `artifacts/delivery-spool` relative to projectDir. */
  rootDir?: string;
  now?: () => Date;
  lockTimeoutMs?: number;
  staleLockMs?: number;
}

export interface ArtifactDeliveryQueue {
  enqueue(input: ArtifactDeliveryInput): Promise<ArtifactDeliveryEnvelope>;
  listPending(): Promise<ArtifactDeliveryEnvelope[]>;
  readReceipt(artifactId: string, version: number): Promise<ArtifactDeliveryReceipt | null>;
  readAttempts(artifactId: string, version: number): Promise<ArtifactDeliveryAttempt[]>;
  flush(target: ArtifactDeliveryTarget, options?: { limit?: number }): Promise<ArtifactDeliveryFlushResult>;
}

export interface HttpArtifactDeliveryTargetOptions {
  endpoint: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export class ArtifactDeliveryConflictError extends Error {
  constructor(readonly artifactId: string, readonly version: number) {
    super(`Artifact ${artifactId} version ${version} already has different immutable content.`);
    this.name = 'ArtifactDeliveryConflictError';
  }
}

export class ArtifactDeliveryIdempotencyConflictError extends Error {
  constructor(readonly idempotencyKey: string) {
    super(`Artifact delivery idempotency key ${idempotencyKey} was reused for different content.`);
    this.name = 'ArtifactDeliveryIdempotencyConflictError';
  }
}

export class ArtifactDeliveryVersionGapError extends Error {
  constructor(
    readonly artifactId: string,
    readonly expectedVersion: number,
    readonly receivedVersion: number,
  ) {
    super(
      `Artifact ${artifactId} expected version ${expectedVersion}, received ${receivedVersion}.`,
    );
    this.name = 'ArtifactDeliveryVersionGapError';
  }
}

export class ArtifactDeliveryCorruptionError extends Error {
  constructor(message: string) {
    super(`Artifact delivery spool is corrupt: ${message}`);
    this.name = 'ArtifactDeliveryCorruptionError';
  }
}

export class ArtifactDeliveryTransportError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ArtifactDeliveryTransportError';
  }
}

export function createFileArtifactDeliveryQueue(
  options: FileArtifactDeliveryQueueOptions,
): ArtifactDeliveryQueue {
  const root = path.isAbsolute(options.rootDir ?? '')
    ? (options.rootDir as string)
    : path.join(options.projectDir, options.rootDir ?? 'artifacts/delivery-spool');
  const now = options.now ?? (() => new Date());
  const lockTimeoutMs = options.lockTimeoutMs ?? 5_000;
  const staleLockMs = options.staleLockMs ?? 30_000;

  async function enqueue(input: ArtifactDeliveryInput): Promise<ArtifactDeliveryEnvelope> {
    assertDeliveryInput(input);
    return withSpoolLock(root, lockTimeoutMs, staleLockMs, async () => {
      const envelopes = await readAllEnvelopes(root);
      const checksum = checksumContents(input.contents);
      const envelopeDigest = digestValue({
        protocolVersion: ARTIFACT_DELIVERY_PROTOCOL_VERSION,
        ...input,
        checksum,
      });
      const idempotent = envelopes.find((entry) => entry.idempotencyKey === input.idempotencyKey);

      if (idempotent) {
        if (idempotent.envelopeDigest !== envelopeDigest) {
          throw new ArtifactDeliveryIdempotencyConflictError(input.idempotencyKey);
        }
        return idempotent;
      }

      const versions = envelopes
        .filter((entry) => entry.artifactId === input.artifactId)
        .sort((left, right) => left.version - right.version);
      const existing = versions.find((entry) => entry.version === input.version);
      if (existing) throw new ArtifactDeliveryConflictError(input.artifactId, input.version);

      const expectedVersion = (versions.at(-1)?.version ?? 0) + 1;
      if (input.version !== expectedVersion) {
        throw new ArtifactDeliveryVersionGapError(input.artifactId, expectedVersion, input.version);
      }

      const envelope: ArtifactDeliveryEnvelope = {
        protocolVersion: ARTIFACT_DELIVERY_PROTOCOL_VERSION,
        ...input,
        checksum,
        envelopeDigest,
      };
      await writeImmutable(envelopePath(root, envelope), `${JSON.stringify(envelope, null, 2)}\n`);
      return envelope;
    });
  }

  async function listPending(): Promise<ArtifactDeliveryEnvelope[]> {
    const envelopes = await readAllEnvelopes(root);
    const pending: ArtifactDeliveryEnvelope[] = [];
    for (const envelope of envelopes) {
      if (!await readReceipt(envelope.artifactId, envelope.version)) pending.push(envelope);
    }
    return pending.sort(compareEnvelopes);
  }

  async function readReceipt(
    artifactId: string,
    version: number,
  ): Promise<ArtifactDeliveryReceipt | null> {
    const filePath = receiptPath(root, artifactId, version);
    let receipt: ArtifactDeliveryReceipt;
    try {
      receipt = JSON.parse(await fs.readFile(filePath, 'utf8')) as ArtifactDeliveryReceipt;
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return null;
      throw new ArtifactDeliveryCorruptionError(`receipt ${artifactId}@${version} is not valid JSON.`);
    }

    const { receiptDigest, ...unsigned } = receipt;
    if (
      receipt.protocolVersion !== ARTIFACT_DELIVERY_PROTOCOL_VERSION
      || receipt.artifactId !== artifactId
      || receipt.version !== version
      || !receipt.receiptId
      || receiptDigest !== digestValue(unsigned)
    ) {
      throw new ArtifactDeliveryCorruptionError(`receipt ${artifactId}@${version} failed validation.`);
    }
    return receipt;
  }

  async function readAttempts(
    artifactId: string,
    version: number,
  ): Promise<ArtifactDeliveryAttempt[]> {
    let contents: string;
    try {
      contents = await fs.readFile(attemptPath(root, artifactId, version), 'utf8');
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return [];
      throw error;
    }
    return contents.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as ArtifactDeliveryAttempt);
  }

  async function flush(
    target: ArtifactDeliveryTarget,
    flushOptions: { limit?: number } = {},
  ): Promise<ArtifactDeliveryFlushResult> {
    if (flushOptions.limit !== undefined && (!Number.isInteger(flushOptions.limit) || flushOptions.limit <= 0)) {
      throw new Error('Artifact delivery flush limit must be a positive integer.');
    }
    const allPending = await listPending();
    const pending = flushOptions.limit === undefined
      ? allPending
      : allPending.slice(0, flushOptions.limit);
    const delivered: ArtifactDeliveryReceipt[] = [];
    const failures: ArtifactDeliveryFailure[] = [];
    const blockedArtifacts = new Set<string>();

    for (const envelope of pending) {
      if (blockedArtifacts.has(envelope.artifactId)) continue;
      try {
        const ack = await target.deliver(envelope);
        assertAck(envelope, ack);
        await appendAttempt(root, envelope, {
          attemptId: randomUUID(),
          artifactId: envelope.artifactId,
          version: envelope.version,
          attemptedAt: now().toISOString(),
          outcome: ack.status,
          ...(ack.status === 'out_of_order'
            ? { message: `Receiver expected version ${String(ack.expectedVersion)}.` }
            : {}),
        });

        if (ack.status === 'out_of_order') {
          failures.push({
            artifactId: envelope.artifactId,
            version: envelope.version,
            message: `Receiver rejected out-of-order delivery; expected ${String(ack.expectedVersion)}.`,
            retryable: true,
          });
          blockedArtifacts.add(envelope.artifactId);
          continue;
        }

        const unsignedReceipt = { ...ack, receiptId: randomUUID() };
        const receipt: ArtifactDeliveryReceipt = {
          ...unsignedReceipt,
          receiptDigest: digestValue(unsignedReceipt),
        };
        const created = await writeImmutable(
          receiptPath(root, envelope.artifactId, envelope.version),
          `${JSON.stringify(receipt, null, 2)}\n`,
        );
        const durableReceipt = created
          ? receipt
          : await readReceipt(envelope.artifactId, envelope.version);
        if (!durableReceipt || durableReceipt.checksum !== envelope.checksum) {
          throw new ArtifactDeliveryCorruptionError(
            `receipt ${envelope.artifactId}@${envelope.version} does not match its envelope.`,
          );
        }
        delivered.push(durableReceipt);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await appendAttempt(root, envelope, {
          attemptId: randomUUID(),
          artifactId: envelope.artifactId,
          version: envelope.version,
          attemptedAt: now().toISOString(),
          outcome: 'failed',
          message,
        });
        failures.push({
          artifactId: envelope.artifactId,
          version: envelope.version,
          message,
          retryable: !(error instanceof ArtifactDeliveryCorruptionError),
        });
        blockedArtifacts.add(envelope.artifactId);
      }
    }

    return { delivered, failures, pending: (await listPending()).length };
  }

  return { enqueue, listPending, readReceipt, readAttempts, flush };
}

export function createHttpArtifactDeliveryTarget(
  options: HttpArtifactDeliveryTargetOptions,
): ArtifactDeliveryTarget {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = `${options.endpoint.replace(/\/$/, '')}/artifact-deliveries`;

  return {
    async deliver(envelope) {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${options.token}`,
          accept: 'application/json',
          'content-type': 'application/json',
          'idempotency-key': envelope.idempotencyKey,
          'x-fdekit-artifact-protocol': String(ARTIFACT_DELIVERY_PROTOCOL_VERSION),
        },
        body: JSON.stringify(envelope),
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (!response.ok && response.status !== 409) {
        throw new ArtifactDeliveryTransportError(
          response.status,
          response.status === 401
            ? 'The worker token was rejected by the artifact delivery endpoint.'
            : `Artifact delivery failed (${response.status}).`,
        );
      }
      if (!body || typeof body !== 'object') {
        throw new ArtifactDeliveryTransportError(response.status, 'Artifact delivery response is missing an acknowledgement.');
      }
      return body as ArtifactDeliveryAck;
    },
  };
}

export function artifactDeliveryId(group: string, fileName: string): string {
  return `artifact:${digestValue({ group, fileName }).slice('sha256:'.length)}`;
}

function assertDeliveryInput(input: ArtifactDeliveryInput): void {
  if (!input.artifactId.trim()) throw new Error('Artifact delivery artifactId is required.');
  if (!Number.isInteger(input.version) || input.version <= 0) {
    throw new Error('Artifact delivery version must be a positive integer.');
  }
  if (!input.idempotencyKey.trim()) throw new Error('Artifact delivery idempotencyKey is required.');
  if (!input.group.trim() || !input.fileName.trim()) throw new Error('Artifact delivery ref is required.');
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error('Artifact delivery createdAt is invalid.');
  assertJsonCompatible(input);
}

function assertAck(envelope: ArtifactDeliveryEnvelope, ack: ArtifactDeliveryAck): void {
  if (
    ack.protocolVersion !== ARTIFACT_DELIVERY_PROTOCOL_VERSION
    || ack.artifactId !== envelope.artifactId
    || ack.version !== envelope.version
    || ack.checksum !== envelope.checksum
    || !['accepted', 'duplicate', 'out_of_order'].includes(ack.status)
  ) {
    throw new ArtifactDeliveryTransportError(502, 'Artifact delivery acknowledgement does not match the envelope.');
  }
  if (ack.status === 'out_of_order' && !Number.isInteger(ack.expectedVersion)) {
    throw new ArtifactDeliveryTransportError(502, 'Out-of-order acknowledgement is missing expectedVersion.');
  }
}

async function readAllEnvelopes(root: string): Promise<ArtifactDeliveryEnvelope[]> {
  const dir = path.join(root, 'envelopes');
  let artifactDirs: string[];
  try {
    artifactDirs = await fs.readdir(dir);
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return [];
    throw error;
  }

  const envelopes: ArtifactDeliveryEnvelope[] = [];
  for (const artifactDir of artifactDirs.sort()) {
    const fullDir = path.join(dir, artifactDir);
    const stat = await fs.stat(fullDir);
    if (!stat.isDirectory()) continue;
    const files = (await fs.readdir(fullDir)).filter((name) => /^\d+\.json$/.test(name)).sort(numericFileSort);
    for (const file of files) {
      let envelope: ArtifactDeliveryEnvelope;
      try {
        envelope = JSON.parse(await fs.readFile(path.join(fullDir, file), 'utf8')) as ArtifactDeliveryEnvelope;
      } catch {
        throw new ArtifactDeliveryCorruptionError(`envelope ${artifactDir}/${file} is not valid JSON.`);
      }
      validateEnvelope(envelope, artifactDir, file);
      envelopes.push(envelope);
    }
  }
  return envelopes.sort(compareEnvelopes);
}

function validateEnvelope(envelope: ArtifactDeliveryEnvelope, artifactDir: string, file: string): void {
  const { envelopeDigest, ...unsigned } = envelope;
  if (
    envelope.protocolVersion !== ARTIFACT_DELIVERY_PROTOCOL_VERSION
    || checksumContents(envelope.contents) !== envelope.checksum
    || digestValue(unsigned) !== envelopeDigest
    || artifactKey(envelope.artifactId) !== artifactDir
    || `${envelope.version}.json` !== file
  ) {
    throw new ArtifactDeliveryCorruptionError(`envelope ${artifactDir}/${file} failed validation.`);
  }
}

async function appendAttempt(
  root: string,
  envelope: ArtifactDeliveryEnvelope,
  attempt: ArtifactDeliveryAttempt,
): Promise<void> {
  const filePath = attemptPath(root, envelope.artifactId, envelope.version);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const handle = await fs.open(filePath, 'a', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(attempt)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeImmutable(filePath: string, contents: string): Promise<boolean> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.link(temporary, filePath);
    return true;
  } catch (error) {
    if (isNodeError(error, 'EEXIST')) return false;
    throw error;
  } finally {
    await fs.unlink(temporary).catch(() => undefined);
  }
}

async function withSpoolLock<Result>(
  root: string,
  timeoutMs: number,
  staleLockMs: number,
  operation: () => Promise<Result>,
): Promise<Result> {
  await fs.mkdir(root, { recursive: true });
  const lockPath = path.join(root, '.enqueue.lock');
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await fs.mkdir(lockPath);
      break;
    } catch (error) {
      if (!isNodeError(error, 'EEXIST')) throw error;
      const stat = await fs.stat(lockPath).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > staleLockMs) {
        await fs.rmdir(lockPath).catch(() => undefined);
        continue;
      }
      if (Date.now() >= deadline) throw new Error('Timed out waiting for the artifact delivery spool lock.');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  try {
    return await operation();
  } finally {
    await fs.rmdir(lockPath).catch(() => undefined);
  }
}

function envelopePath(root: string, envelope: Pick<ArtifactDeliveryEnvelope, 'artifactId' | 'version'>): string {
  return path.join(root, 'envelopes', artifactKey(envelope.artifactId), `${envelope.version}.json`);
}

function receiptPath(root: string, artifactId: string, version: number): string {
  return path.join(root, 'receipts', artifactKey(artifactId), `${version}.json`);
}

function attemptPath(root: string, artifactId: string, version: number): string {
  return path.join(root, 'attempts', artifactKey(artifactId), `${version}.jsonl`);
}

function artifactKey(artifactId: string): string {
  return createHash('sha256').update(artifactId).digest('hex');
}

function checksumContents(contents: string): string {
  return `sha256:${createHash('sha256').update(contents).digest('hex')}`;
}

function digestValue(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(sortValue(value))).digest('hex')}`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => [key, sortValue(nested)]));
}

function assertJsonCompatible(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error('Artifact delivery input must not contain cycles.');
    seen.add(value);
    value.forEach((entry) => assertJsonCompatible(entry, seen));
    seen.delete(value);
    return;
  }
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('Artifact delivery input must contain only plain JSON objects.');
    }
    if (seen.has(value)) throw new Error('Artifact delivery input must not contain cycles.');
    seen.add(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => assertJsonCompatible(entry, seen));
    seen.delete(value);
    return;
  }
  throw new Error(`Artifact delivery input contains a non-JSON value (${typeof value}).`);
}

function compareEnvelopes(left: ArtifactDeliveryEnvelope, right: ArtifactDeliveryEnvelope): number {
  return left.artifactId.localeCompare(right.artifactId) || left.version - right.version;
}

function numericFileSort(left: string, right: string): number {
  return Number.parseInt(left, 10) - Number.parseInt(right, 10);
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}
