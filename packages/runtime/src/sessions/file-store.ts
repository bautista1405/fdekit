import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { isExecutionState } from '@fdekit/core';
import { assertExecutionStateTransition } from './state-machine.js';
import {
  SESSION_PROTOCOL_VERSION,
  type AppendSessionEventOptions,
  type AppendSessionEventResult,
  type FileSessionStoreOptions,
  type ReadSessionEventsOptions,
  type SessionEvent,
  type SessionEventInput,
  type SessionProjection,
  type SessionSnapshot,
  type SessionStore,
  type WriteSessionSnapshotOptions,
} from './types.js';

const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export class InvalidSessionIdError extends Error {
  constructor(readonly sessionId: string) {
    super(`Invalid session id "${sessionId}". Use 1-128 letters, numbers, dots, underscores, or hyphens.`);
    this.name = 'InvalidSessionIdError';
  }
}

export class SessionRevisionConflictError extends Error {
  constructor(
    readonly sessionId: string,
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(
      `Session ${sessionId} revision conflict: expected ${expectedRevision}, found ${actualRevision}.`,
    );
    this.name = 'SessionRevisionConflictError';
  }
}

export class SessionEventConflictError extends Error {
  constructor(
    readonly sessionId: string,
    readonly identifier: string,
  ) {
    super(`Session ${sessionId} already contains a different event for ${identifier}.`);
    this.name = 'SessionEventConflictError';
  }
}

export class SessionCorruptionError extends Error {
  constructor(
    readonly sessionId: string,
    message: string,
  ) {
    super(`Session ${sessionId} is corrupt: ${message}`);
    this.name = 'SessionCorruptionError';
  }
}

export class SessionLockTimeoutError extends Error {
  constructor(readonly sessionId: string) {
    super(`Timed out waiting to append to session ${sessionId}.`);
    this.name = 'SessionLockTimeoutError';
  }
}

export class SessionSnapshotConflictError extends Error {
  constructor(
    readonly sessionId: string,
    readonly revision: number,
  ) {
    super(`Session ${sessionId} already has different snapshot content at revision ${revision}.`);
    this.name = 'SessionSnapshotConflictError';
  }
}

export class SessionTombstonedError extends Error {
  constructor(readonly sessionId: string) {
    super(`Session ${sessionId} is tombstoned and cannot accept new events.`);
    this.name = 'SessionTombstonedError';
  }
}

export function createFileSessionStore(options: FileSessionStoreOptions): SessionStore {
  const root = path.isAbsolute(options.rootDir ?? '')
    ? (options.rootDir as string)
    : path.join(options.projectDir, options.rootDir ?? 'artifacts/sessions');
  const lockTimeoutMs = options.lockTimeoutMs ?? 5_000;
  const staleLockMs = options.staleLockMs ?? 30_000;
  const now = options.now ?? (() => new Date());

  return {
    async append<Payload>(
      sessionId: string,
      input: SessionEventInput<Payload>,
      appendOptions: AppendSessionEventOptions = {},
    ): Promise<AppendSessionEventResult<Payload>> {
      assertSessionId(sessionId);
      assertEventInput(input);
      const sessionDir = sessionPath(root, sessionId);

      return withSessionLock(sessionId, sessionDir, lockTimeoutMs, staleLockMs, async () => {
        const events = await readEventsFile(sessionId, eventsPath(sessionDir));
        const projection = projectSession(sessionId, events);
        const digest = eventDigest(sessionId, input);
        const duplicate = events.find((event) => event.idempotencyKey === input.idempotencyKey);

        if (duplicate) {
          if (duplicate.contentDigest !== digest) {
            throw new SessionEventConflictError(sessionId, `idempotency key ${input.idempotencyKey}`);
          }

          const restoredProjection = projection as SessionProjection;
          await writeProjection(sessionDir, restoredProjection);
          return {
            event: duplicate as SessionEvent<Payload>,
            projection: restoredProjection,
            appended: false,
          };
        }

        const duplicateId = events.find((event) => event.eventId === input.eventId);
        if (duplicateId) {
          throw new SessionEventConflictError(sessionId, `event id ${input.eventId}`);
        }

        const actualRevision = projection?.revision ?? 0;
        if (
          appendOptions.expectedRevision !== undefined
          && appendOptions.expectedRevision !== actualRevision
        ) {
          throw new SessionRevisionConflictError(
            sessionId,
            appendOptions.expectedRevision,
            actualRevision,
          );
        }

        if (projection?.tombstonedAt) {
          throw new SessionTombstonedError(sessionId);
        }

        if (!projection && !input.state) {
          throw new SessionCorruptionError(sessionId, 'the first event must establish an execution state.');
        }

        if (projection && input.state) {
          assertExecutionStateTransition(projection.state, input.state);
        }

        const event: SessionEvent<Payload> = {
          ...input,
          schemaVersion: SESSION_PROTOCOL_VERSION,
          sessionId,
          sequence: actualRevision + 1,
          recordedAt: now().toISOString(),
          contentDigest: digest,
        };

        await appendDurably(eventsPath(sessionDir), event);
        const nextProjection = projectSession(sessionId, [...events, event]);

        if (!nextProjection) {
          throw new SessionCorruptionError(sessionId, 'the committed event did not produce a projection.');
        }

        await writeProjection(sessionDir, nextProjection);
        return { event, projection: nextProjection, appended: true };
      });
    },

    async readEvents<Payload>(
      sessionId: string,
      readOptions: ReadSessionEventsOptions = {},
    ): Promise<Array<SessionEvent<Payload>>> {
      assertSessionId(sessionId);
      assertReadOptions(readOptions);
      const events = await readEventsFile(sessionId, eventsPath(sessionPath(root, sessionId)));
      const afterRevision = readOptions.afterRevision ?? 0;
      const selected = events.filter((event) => event.sequence > afterRevision);
      return (readOptions.limit === undefined ? selected : selected.slice(0, readOptions.limit)) as Array<
        SessionEvent<Payload>
      >;
    },

    async getProjection(sessionId: string): Promise<SessionProjection | null> {
      assertSessionId(sessionId);
      const events = await readEventsFile(sessionId, eventsPath(sessionPath(root, sessionId)));
      return projectSession(sessionId, events);
    },

    async writeSnapshot<State>(
      sessionId: string,
      state: State,
      snapshotOptions: WriteSessionSnapshotOptions,
    ): Promise<SessionSnapshot<State>> {
      assertSessionId(sessionId);
      assertJsonCompatible(state, 'snapshot state');
      const sessionDir = sessionPath(root, sessionId);

      return withSessionLock(sessionId, sessionDir, lockTimeoutMs, staleLockMs, async () => {
        const events = await readEventsFile(sessionId, eventsPath(sessionDir));
        const projection = projectSession(sessionId, events);
        const actualRevision = projection?.revision ?? 0;

        if (!projection || snapshotOptions.expectedRevision !== actualRevision) {
          throw new SessionRevisionConflictError(
            sessionId,
            snapshotOptions.expectedRevision,
            actualRevision,
          );
        }

        const contentDigest = digestValue({
          schemaVersion: SESSION_PROTOCOL_VERSION,
          sessionId,
          revision: projection.revision,
          executionState: projection.state,
          state,
        });
        const snapshot: SessionSnapshot<State> = {
          schemaVersion: SESSION_PROTOCOL_VERSION,
          sessionId,
          revision: projection.revision,
          executionState: projection.state,
          createdAt: now().toISOString(),
          state,
          contentDigest,
        };
        const filePath = snapshotPath(sessionDir, projection.revision);
        const created = await writeImmutable(filePath, `${JSON.stringify(snapshot, null, 2)}\n`);

        if (!created) {
          const existing = await readSnapshotFile<State>(sessionId, filePath);
          if (!existing || existing.contentDigest !== contentDigest) {
            throw new SessionSnapshotConflictError(sessionId, projection.revision);
          }
          return existing;
        }

        return snapshot;
      });
    },

    async readLatestSnapshot<State>(sessionId: string): Promise<SessionSnapshot<State> | null> {
      assertSessionId(sessionId);
      const dir = path.join(sessionPath(root, sessionId), 'snapshots');
      let names: string[];

      try {
        names = await fs.readdir(dir);
      } catch (error) {
        if (isNodeError(error, 'ENOENT')) return null;
        throw error;
      }

      const latest = names
        .filter((name) => /^\d+\.json$/.test(name))
        .sort((left, right) => Number.parseInt(right, 10) - Number.parseInt(left, 10))[0];

      return latest ? readSnapshotFile<State>(sessionId, path.join(dir, latest)) : null;
    },
  };
}

export function projectSession(
  sessionId: string,
  events: readonly SessionEvent[],
): SessionProjection | null {
  if (events.length === 0) return null;

  const first = events[0];
  if (!first?.state) {
    throw new SessionCorruptionError(sessionId, 'the first event does not establish an execution state.');
  }

  let state = first.state;
  let identity = first.identity;
  let tombstonedAt = first.type === 'session.tombstoned' ? first.occurredAt : undefined;

  for (const event of events.slice(1)) {
    if (event.state) {
      try {
        assertExecutionStateTransition(state, event.state);
      } catch (error) {
        throw new SessionCorruptionError(
          sessionId,
          error instanceof Error ? error.message : String(error),
        );
      }
      state = event.state;
    }
    if (event.identity) identity = { ...identity, ...event.identity };
    if (event.type === 'session.tombstoned') tombstonedAt = event.occurredAt;
  }

  const last = events.at(-1) as SessionEvent;
  return {
    schemaVersion: SESSION_PROTOCOL_VERSION,
    sessionId,
    revision: last.sequence,
    eventCount: events.length,
    state,
    createdAt: first.occurredAt,
    updatedAt: last.occurredAt,
    lastEventId: last.eventId,
    ...(identity ? { identity } : {}),
    ...(tombstonedAt ? { tombstonedAt } : {}),
  };
}

function assertSessionId(sessionId: string): void {
  if (!SESSION_ID_PATTERN.test(sessionId)) throw new InvalidSessionIdError(sessionId);
}

function assertEventInput(input: SessionEventInput): void {
  if (!input.eventId.trim()) throw new Error('Session eventId is required.');
  if (!input.idempotencyKey.trim()) throw new Error('Session idempotencyKey is required.');
  if (!input.type.trim()) throw new Error('Session event type is required.');
  if (!Number.isFinite(Date.parse(input.occurredAt))) {
    throw new Error(`Session occurredAt must be an ISO-compatible timestamp; received ${input.occurredAt}.`);
  }
  if (input.state !== undefined && !isExecutionState(input.state)) {
    throw new Error(`Unknown execution state: ${String(input.state)}.`);
  }
  assertJsonCompatible(input, 'session event');
}

function assertReadOptions(options: ReadSessionEventsOptions): void {
  if (
    options.afterRevision !== undefined
    && (!Number.isInteger(options.afterRevision) || options.afterRevision < 0)
  ) {
    throw new Error('afterRevision must be a non-negative integer.');
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit <= 0)) {
    throw new Error('limit must be a positive integer.');
  }
}

async function readEventsFile(sessionId: string, filePath: string): Promise<SessionEvent[]> {
  let contents: string;

  try {
    contents = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return [];
    throw error;
  }

  const lines = contents.split(/\r?\n/).filter(Boolean);
  return lines.map((line, index) => {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new SessionCorruptionError(sessionId, `event line ${index + 1} is not valid JSON.`);
    }

    if (!value || typeof value !== 'object') {
      throw new SessionCorruptionError(sessionId, `event line ${index + 1} is not an object.`);
    }

    const event = value as SessionEvent;
    if (event.schemaVersion !== SESSION_PROTOCOL_VERSION) {
      throw new SessionCorruptionError(
        sessionId,
        `event line ${index + 1} has unsupported schema version ${String(event.schemaVersion)}.`,
      );
    }
    if (event.sessionId !== sessionId) {
      throw new SessionCorruptionError(sessionId, `event line ${index + 1} belongs to ${event.sessionId}.`);
    }
    if (event.sequence !== index + 1) {
      throw new SessionCorruptionError(
        sessionId,
        `event line ${index + 1} has sequence ${String(event.sequence)}.`,
      );
    }
    if (event.state !== undefined && !isExecutionState(event.state)) {
      throw new SessionCorruptionError(sessionId, `event line ${index + 1} has an unknown state.`);
    }
    if (event.contentDigest !== eventDigest(sessionId, logicalEventInput(event))) {
      throw new SessionCorruptionError(sessionId, `event line ${index + 1} failed its content digest.`);
    }

    return event;
  });
}

async function readSnapshotFile<State>(
  sessionId: string,
  filePath: string,
): Promise<SessionSnapshot<State> | null> {
  let value: SessionSnapshot<State>;
  try {
    value = JSON.parse(await fs.readFile(filePath, 'utf8')) as SessionSnapshot<State>;
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return null;
    throw new SessionCorruptionError(sessionId, `snapshot ${path.basename(filePath)} is not valid JSON.`);
  }

  if (
    value.schemaVersion !== SESSION_PROTOCOL_VERSION
    || value.sessionId !== sessionId
    || value.contentDigest !== digestValue({
      schemaVersion: value.schemaVersion,
      sessionId: value.sessionId,
      revision: value.revision,
      executionState: value.executionState,
      state: value.state,
    })
  ) {
    throw new SessionCorruptionError(sessionId, `snapshot ${path.basename(filePath)} failed validation.`);
  }

  return value;
}

function logicalEventInput<Payload>(event: SessionEvent<Payload>): SessionEventInput<Payload> {
  const {
    schemaVersion: _schemaVersion,
    sessionId: _sessionId,
    sequence: _sequence,
    recordedAt: _recordedAt,
    contentDigest: _contentDigest,
    ...input
  } = event;
  return input;
}

function eventDigest(sessionId: string, input: SessionEventInput): string {
  return digestValue({ schemaVersion: SESSION_PROTOCOL_VERSION, sessionId, ...input });
}

function digestValue(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableSerialize(value)).digest('hex')}`;
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortValue(entry)]),
  );
}

function assertJsonCompatible(value: unknown, label: string, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;

  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error(`${label} must not contain cycles.`);
    seen.add(value);
    value.forEach((entry) => assertJsonCompatible(entry, label, seen));
    seen.delete(value);
    return;
  }

  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${label} must contain only plain JSON objects.`);
    }
    if (seen.has(value)) throw new Error(`${label} must not contain cycles.`);
    seen.add(value);
    Object.values(value as Record<string, unknown>).forEach((entry) =>
      assertJsonCompatible(entry, label, seen));
    seen.delete(value);
    return;
  }

  throw new Error(`${label} contains a non-JSON value (${typeof value}).`);
}

async function appendDurably(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const handle = await fs.open(filePath, 'a', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeProjection(sessionDir: string, projection: SessionProjection): Promise<void> {
  await writeAtomic(
    path.join(sessionDir, 'projection.json'),
    `${JSON.stringify(projection, null, 2)}\n`,
  );
}

async function writeAtomic(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporaryPath, 'wx', 0o600);
  try {
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function writeImmutable(filePath: string, contents: string): Promise<boolean> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporaryPath, 'wx', 0o600);
  try {
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await fs.link(temporaryPath, filePath);
    return true;
  } catch (error) {
    if (isNodeError(error, 'EEXIST')) return false;
    throw error;
  } finally {
    await fs.unlink(temporaryPath).catch(() => undefined);
  }
}

async function withSessionLock<Result>(
  sessionId: string,
  sessionDir: string,
  timeoutMs: number,
  staleLockMs: number,
  operation: () => Promise<Result>,
): Promise<Result> {
  await fs.mkdir(sessionDir, { recursive: true });
  const lockPath = path.join(sessionDir, '.append.lock');
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
      if (Date.now() >= deadline) throw new SessionLockTimeoutError(sessionId);
      await delay(10);
    }
  }

  try {
    return await operation();
  } finally {
    await fs.rmdir(lockPath).catch(() => undefined);
  }
}

function sessionPath(root: string, sessionId: string): string {
  return path.join(root, sessionId);
}

function eventsPath(sessionDir: string): string {
  return path.join(sessionDir, 'events.jsonl');
}

function snapshotPath(sessionDir: string, revision: number): string {
  return path.join(sessionDir, 'snapshots', `${revision}.json`);
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
