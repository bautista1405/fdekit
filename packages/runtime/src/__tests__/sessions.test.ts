import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  InvalidExecutionStateTransitionError,
  InvalidSessionIdError,
  SessionCorruptionError,
  SessionEventConflictError,
  SessionRevisionConflictError,
  SessionSnapshotConflictError,
  SessionTombstonedError,
  allowedExecutionStateTransitions,
  canTransitionExecutionState,
  createFileSessionStore,
  type SessionEventInput,
} from '../sessions/index.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('file session store', () => {
  it('replays durable state after restart and reconciles an in-doubt action once', async () => {
    const projectDir = await temporaryProject();
    const firstStore = createFileSessionStore({ projectDir });
    const created = event('created', 'session.created', 'queued');
    const planning = event('planning', 'state.transitioned', 'planning');

    await firstStore.append('run-1', created, { expectedRevision: 0 });
    await firstStore.append('run-1', planning, { expectedRevision: 1 });
    await firstStore.writeSnapshot('run-1', { cursor: 2, completedTools: [] }, { expectedRevision: 2 });

    const restartedStore = createFileSessionStore({ projectDir });
    expect(await restartedStore.getProjection('run-1')).toMatchObject({
      revision: 2,
      state: 'planning',
      eventCount: 2,
    });

    const retry = await restartedStore.append('run-1', planning, { expectedRevision: 0 });
    expect(retry.appended).toBe(false);
    expect(retry.event.sequence).toBe(2);

    await restartedStore.append(
      'run-1',
      event('action-started', 'action.started', 'running', {
        actionId: 'publish-review',
        fenceToken: 'worker-lease-7',
      }),
      { expectedRevision: 2 },
    );
    await restartedStore.append(
      'run-1',
      event('action-uncertain', 'action.uncertain', 'reconciling', {
        actionId: 'publish-review',
        fenceToken: 'worker-lease-7',
      }),
      { expectedRevision: 3 },
    );

    const secondRestart = createFileSessionStore({ projectDir });
    expect(await secondRestart.getProjection('run-1')).toMatchObject({ revision: 4, state: 'reconciling' });
    await secondRestart.append(
      'run-1',
      event('action-reconciled', 'action.reconciled', 'completed', {
        actionId: 'publish-review',
        fenceToken: 'worker-lease-7',
        outcome: 'already_committed',
      }),
      { expectedRevision: 4 },
    );
    await secondRestart.writeSnapshot('run-1', { cursor: 5, outcome: 'committed' }, { expectedRevision: 5 });

    expect(await secondRestart.readEvents('run-1')).toHaveLength(5);
    expect(await secondRestart.getProjection('run-1')).toMatchObject({ revision: 5, state: 'completed' });
    expect(await secondRestart.readLatestSnapshot('run-1')).toMatchObject({
      revision: 5,
      executionState: 'completed',
      state: { cursor: 5, outcome: 'committed' },
    });
  });

  it('serializes concurrent writers and enforces optimistic revisions', async () => {
    const projectDir = await temporaryProject();
    const leftStore = createFileSessionStore({ projectDir });
    const rightStore = createFileSessionStore({ projectDir });
    await leftStore.append('run-race', event('created', 'session.created', 'queued'), {
      expectedRevision: 0,
    });

    const results = await Promise.allSettled([
      leftStore.append('run-race', event('left', 'state.transitioned', 'planning'), {
        expectedRevision: 1,
      }),
      rightStore.append('run-race', event('right', 'state.transitioned', 'running'), {
        expectedRevision: 1,
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find((result) => result.status === 'rejected');
    expect(rejection).toMatchObject({ reason: expect.any(SessionRevisionConflictError) });
    expect(await leftStore.readEvents('run-race')).toHaveLength(2);
  });

  it('rejects conflicting idempotent retries and immutable snapshot rewrites', async () => {
    const projectDir = await temporaryProject();
    const store = createFileSessionStore({ projectDir });
    await store.append('run-conflict', event('created', 'session.created', 'queued'));

    await expect(store.append('run-conflict', {
      ...event('different-id', 'state.transitioned', 'planning'),
      idempotencyKey: 'created-key',
    })).rejects.toBeInstanceOf(SessionEventConflictError);

    const original = await store.writeSnapshot('run-conflict', { cursor: 1 }, { expectedRevision: 1 });
    const retry = await store.writeSnapshot('run-conflict', { cursor: 1 }, { expectedRevision: 1 });
    expect(retry).toEqual(original);
    await expect(
      store.writeSnapshot('run-conflict', { cursor: 2 }, { expectedRevision: 1 }),
    ).rejects.toBeInstanceOf(SessionSnapshotConflictError);
  });

  it('validates state transitions and refuses writes after a tombstone', async () => {
    const projectDir = await temporaryProject();
    const store = createFileSessionStore({ projectDir });

    expect(canTransitionExecutionState('running', 'needs_approval')).toBe(true);
    expect(canTransitionExecutionState('completed', 'running')).toBe(false);
    expect(allowedExecutionStateTransitions('needs_input')).toContain('running');

    await store.append('run-terminal', event('created', 'session.created', 'completed'));
    await expect(
      store.append('run-terminal', event('restart', 'state.transitioned', 'running')),
    ).rejects.toBeInstanceOf(InvalidExecutionStateTransitionError);

    await store.append('run-terminal', event('tombstone', 'session.tombstoned', 'completed'));
    await expect(
      store.append('run-terminal', event('after-tombstone', 'artifact.linked')),
    ).rejects.toBeInstanceOf(SessionTombstonedError);
  });

  it('fails loudly on corrupt logs and rejects path-like session ids', async () => {
    const projectDir = await temporaryProject();
    const store = createFileSessionStore({ projectDir });
    await expect(
      store.append('../escape', event('created', 'session.created', 'queued')),
    ).rejects.toBeInstanceOf(InvalidSessionIdError);

    await store.append('run-corrupt', event('created', 'session.created', 'queued'));
    const logPath = path.join(projectDir, 'artifacts', 'sessions', 'run-corrupt', 'events.jsonl');
    const contents = await fs.readFile(logPath, 'utf8');
    await fs.writeFile(logPath, contents.replace('created-key', 'tampered-key'), 'utf8');

    await expect(store.getProjection('run-corrupt')).rejects.toBeInstanceOf(SessionCorruptionError);
  });
});

function event<Payload = unknown>(
  id: string,
  type: string,
  state?: SessionEventInput['state'],
  payload?: Payload,
): SessionEventInput<Payload> {
  return {
    eventId: `${id}-event`,
    idempotencyKey: `${id}-key`,
    type,
    occurredAt: '2026-08-19T12:00:00.000Z',
    ...(state ? { state } : {}),
    ...(payload === undefined ? {} : { payload }),
  };
}

async function temporaryProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'fdekit-session-'));
  temporaryDirectories.push(dir);
  return dir;
}
