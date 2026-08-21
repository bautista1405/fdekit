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
  cancelSession,
  acquireSessionLease,
  appendSessionCheckpoint,
  appendSessionEventWithOutbox,
  commitExternalAction,
  dispatchExternalAction,
  enqueueSessionOutbox,
  expireSession,
  failExternalAction,
  markExternalActionUncertain,
  markSessionOutboxDelivered,
  observeExternalAction,
  prepareExternalAction,
  purgeSession,
  reconcileExternalAction,
  recordSessionHeartbeat,
  recordSessionInbox,
  releaseSessionLease,
  renewSessionLease,
  scheduleSessionRetry,
  tombstoneSession,
  ExternalActionReconciliationRequiredError,
  SessionLeaseConflictError,
  StaleSessionLeaseError,
  type SessionEventInput,
} from '../sessions/index.js';
import type { ActorIdentity, PlannedAction } from '@fdekit/core';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('file session store', () => {
  it('commits an ordered event batch with one projection update', async () => {
    const projectDir = await temporaryProject();
    const store = createFileSessionStore({ projectDir });
    const result = await store.appendBatch?.('run-batch', [
      event('created', 'session.created', 'queued'),
      event('planned', 'context.planned', 'planning'),
      event('started', 'action.started', 'running'),
    ], { expectedRevision: 0 });

    expect(result).toMatchObject({ appendedCount: 3, projection: { revision: 3, state: 'running' } });
    expect(await store.readEvents('run-batch')).toEqual([
      expect.objectContaining({ sequence: 1, type: 'session.created' }),
      expect.objectContaining({ sequence: 2, type: 'context.planned' }),
      expect.objectContaining({ sequence: 3, type: 'action.started' }),
    ]);
  });

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

  it('records cancellation, retry, expiry, tombstone, and explicit purge lifecycle operations', async () => {
    const projectDir = await temporaryProject();
    const store = createFileSessionStore({ projectDir });
    await store.append('run-cancel', event('created', 'session.created', 'running'));
    await scheduleSessionRetry(store, 'run-cancel', {
      attemptId: 'attempt-2',
      retryAt: '2026-08-19T12:01:00.000Z',
      reason: 'transient provider failure',
    });
    await cancelSession(store, 'run-cancel', { reason: 'operator request' });
    expect(await store.getProjection('run-cancel')).toMatchObject({ state: 'cancelled', revision: 3 });

    await store.append('run-expire', event('created-expire', 'session.created', 'running'));
    await expireSession(store, 'run-expire', { reason: 'lease expired' });
    expect(await store.getProjection('run-expire')).toMatchObject({ state: 'expired' });

    await tombstoneSession(store, 'run-expire', { reason: 'retention elapsed' });
    await purgeSession(store, 'run-expire');
    expect(await store.getProjection('run-expire')).toBeNull();
  });

  it('fences concurrent and stale workers with monotonic lease epochs', async () => {
    const projectDir = await temporaryProject();
    const leftStore = createFileSessionStore({ projectDir });
    const rightStore = createFileSessionStore({ projectDir });
    await leftStore.append('run-lease', event('created', 'session.created', 'running'));

    const workerA = actor('worker-a');
    const attempts = await Promise.allSettled([
      acquireSessionLease(leftStore, 'run-lease', {
        leaseId: 'lease-a', owner: workerA, ttlMs: 1_000, now: date('12:00:00'),
      }),
      acquireSessionLease(rightStore, 'run-lease', {
        leaseId: 'lease-b', owner: actor('worker-b'), ttlMs: 1_000, now: date('12:00:00'),
      }),
    ]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.find((result) => result.status === 'rejected')?.reason).toSatisfy(
      (reason: unknown) => reason instanceof SessionLeaseConflictError
        || reason instanceof Error && reason.name === 'SessionRevisionConflictError',
    );

    const leaseA = attempts.find((result) => result.status === 'fulfilled')?.value;
    expect(leaseA).toBeDefined();
    const currentOwner = leaseA?.owner.id === 'worker-a' ? workerA : actor('worker-b');
    const current = leaseA as NonNullable<typeof leaseA>;
    const renewed = await renewSessionLease(leftStore, 'run-lease', {
      lease: { leaseId: current.leaseId, epoch: current.epoch, owner: currentOwner },
      ttlMs: 2_000,
      now: date('12:00:00.500'),
    });
    expect(renewed.expiresAt).toBe('2026-08-19T12:00:02.500Z');

    const replacement = await acquireSessionLease(rightStore, 'run-lease', {
      leaseId: 'lease-replacement', owner: actor('worker-c'), ttlMs: 1_000, now: date('12:00:03'),
    });
    expect(replacement.epoch).toBe(current.epoch + 1);
    await expect(recordSessionHeartbeat(leftStore, 'run-lease', {
      lease: { leaseId: current.leaseId, epoch: current.epoch, owner: currentOwner },
      now: date('12:00:03'),
    })).rejects.toBeInstanceOf(StaleSessionLeaseError);
    expect(await releaseSessionLease(rightStore, 'run-lease', {
      lease: {
        leaseId: replacement.leaseId,
        epoch: replacement.epoch,
        owner: replacement.owner,
      },
      now: date('12:00:03.100'),
    })).toMatchObject({ status: 'released', releasedAt: '2026-08-19T12:00:03.100Z' });
  });

  it('fences checkpoints and never blindly redispatches an uncertain external action', async () => {
    const projectDir = await temporaryProject();
    const store = createFileSessionStore({ projectDir });
    await store.append('run-action', event('created', 'session.created', 'running'));
    const owner = actor('worker-a');
    const lease = await acquireSessionLease(store, 'run-action', {
      leaseId: 'lease-action', owner, ttlMs: 1_000, now: date('12:00:00'),
    });
    const token = { leaseId: lease.leaseId, epoch: lease.epoch, owner };
    await appendSessionCheckpoint(store, 'run-action', {
      lease: token, checkpoint: { cursor: 2 }, now: date('12:00:00.100'),
    });
    await recordSessionHeartbeat(store, 'run-action', { lease: token, now: date('12:00:00.200') });

    const action = plannedAction('run-action');
    expect(await prepareExternalAction(store, 'run-action', {
      lease: token, action, now: date('12:00:00.300'),
    })).toMatchObject({ status: 'prepared', fenceEpoch: 1 });
    await dispatchExternalAction(store, 'run-action', {
      lease: token, actionId: action.actionId, now: date('12:00:00.400'),
    });
    await markExternalActionUncertain(store, 'run-action', {
      lease: token, actionId: action.actionId, outcome: 'provider response lost', now: date('12:00:00.500'),
    });
    await expect(dispatchExternalAction(store, 'run-action', {
      lease: token, actionId: action.actionId, now: date('12:00:00.600'),
    })).rejects.toBeInstanceOf(ExternalActionReconciliationRequiredError);

    const replacement = await acquireSessionLease(store, 'run-action', {
      leaseId: 'lease-reconcile', owner: actor('worker-b'), purpose: 'reconciliation',
      ttlMs: 1_000, now: date('12:00:02'),
    });
    const reconciled = await reconcileExternalAction(store, 'run-action', {
      lease: { leaseId: replacement.leaseId, epoch: replacement.epoch, owner: replacement.owner },
      actionId: action.actionId,
      outcome: 'already_committed',
      providerEffectId: 'provider-effect-1',
      now: date('12:00:02.100'),
    });
    expect(reconciled).toMatchObject({
      status: 'reconciled', providerEffectId: 'provider-effect-1', fenceEpoch: 2,
    });
  });

  it('supports the observed commit path and blocks new actions after cancellation', async () => {
    const projectDir = await temporaryProject();
    const store = createFileSessionStore({ projectDir });
    await store.append('run-commit', event('created', 'session.created', 'running'));
    const owner = actor('worker-a');
    const lease = await acquireSessionLease(store, 'run-commit', {
      leaseId: 'lease-commit', owner, ttlMs: 10_000, now: date('12:00:00'),
    });
    const token = { leaseId: lease.leaseId, epoch: lease.epoch, owner };
    const action = plannedAction('run-commit');
    await prepareExternalAction(store, 'run-commit', { lease: token, action, now: date('12:00:00.100') });
    await dispatchExternalAction(store, 'run-commit', {
      lease: token, actionId: action.actionId, now: date('12:00:00.200'),
    });
    await observeExternalAction(store, 'run-commit', {
      lease: token, actionId: action.actionId, providerEffectId: 'effect-1', now: date('12:00:00.300'),
    });
    expect(await commitExternalAction(store, 'run-commit', {
      lease: token, actionId: action.actionId, now: date('12:00:00.400'),
    })).toMatchObject({ status: 'committed', providerEffectId: 'effect-1' });

    await cancelSession(store, 'run-commit', { reason: 'operator request' });
    await expect(prepareExternalAction(store, 'run-commit', {
      lease: token,
      action: { ...plannedAction('run-commit'), actionId: 'second-action', idempotencyKey: 'second-key' },
      now: date('12:00:00.500'),
    })).rejects.toThrow('does not admit new external actions');
  });

  it('records a provider-confirmed external-action failure as terminal', async () => {
    const projectDir = await temporaryProject();
    const store = createFileSessionStore({ projectDir });
    await store.append('run-action-failed', event('created', 'session.created', 'running'));
    const owner = actor('worker-a');
    const lease = await acquireSessionLease(store, 'run-action-failed', {
      leaseId: 'lease-failed', owner, ttlMs: 10_000, now: date('12:00:00'),
    });
    const token = { leaseId: lease.leaseId, epoch: lease.epoch, owner };
    const action = plannedAction('run-action-failed');
    await prepareExternalAction(store, 'run-action-failed', {
      lease: token, action, now: date('12:00:00.100'),
    });
    await dispatchExternalAction(store, 'run-action-failed', {
      lease: token, actionId: action.actionId, now: date('12:00:00.200'),
    });
    expect(await failExternalAction(store, 'run-action-failed', {
      lease: token,
      actionId: action.actionId,
      outcome: 'provider_rejected',
      now: date('12:00:00.300'),
    })).toMatchObject({ status: 'failed', outcome: 'provider_rejected' });
    expect(await store.getProjection('run-action-failed')).toMatchObject({ state: 'failed' });
  });

  it('deduplicates inbox/outbox messages and records delivery explicitly', async () => {
    const projectDir = await temporaryProject();
    const store = createFileSessionStore({ projectDir });
    await store.append('run-message', event('created', 'session.created', 'queued'));

    const firstInbox = await recordSessionInbox(store, 'run-message', {
      messageId: 'delivery-1', idempotencyKey: 'github:delivery-1', payload: { pullRequest: 42 },
      occurredAt: '2026-08-19T12:00:00.000Z',
    });
    const duplicateInbox = await recordSessionInbox(store, 'run-message', {
      messageId: 'delivery-1', idempotencyKey: 'github:delivery-1', payload: { pullRequest: 42 },
      occurredAt: '2026-08-19T12:00:00.000Z',
    });
    expect(firstInbox.appended).toBe(true);
    expect(duplicateInbox.appended).toBe(false);

    const queued = await enqueueSessionOutbox(store, 'run-message', {
      messageId: 'notification-1', idempotencyKey: 'notify:run-message', payload: { status: 'ready' },
      occurredAt: '2026-08-19T12:00:01.000Z',
    });
    expect(await markSessionOutboxDelivered(store, 'run-message', {
      messageId: 'notification-1', idempotencyKey: queued.event.idempotencyKey,
      occurredAt: '2026-08-19T12:00:02.000Z',
    })).toMatchObject({ appended: true });

    const atomic = await appendSessionEventWithOutbox(
      store,
      'run-message',
      event('planned-message', 'state.transitioned', 'planning'),
      {
        messageId: 'notification-2',
        idempotencyKey: 'notify:run-message:planned',
        payload: { status: 'planned' },
        occurredAt: '2026-08-19T12:00:03.000Z',
      },
    );
    expect(atomic).toMatchObject({ appendedCount: 2, projection: { state: 'planning' } });
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

function actor(id: string): ActorIdentity {
  return { id, kind: 'service_principal' };
}

function date(time: string): Date {
  return new Date(`2026-08-19T${time}Z`);
}

function plannedAction(runId: string): PlannedAction {
  return {
    schemaVersion: 1,
    actionId: 'publish-review',
    identity: { taskId: 'task-1', runId, attemptId: 'attempt-1', stepId: 'step-1' },
    capability: 'external:write',
    target: 'github:pull-request:42',
    operation: 'review.publish',
    argumentsDigest: 'sha256:arguments',
    sourceSnapshots: [],
    idempotencyKey: 'publish-review-key',
    plannedAt: '2026-08-19T12:00:00.000Z',
  };
}
