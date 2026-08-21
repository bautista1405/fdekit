import { randomUUID } from 'node:crypto';
import { isTerminalExecutionState, type ActorIdentity } from '@fdekit/core';
import type { SessionEventInput, SessionStore } from './types.js';

export interface SessionLifecycleOptions {
  reason: string;
  actor?: ActorIdentity;
  occurredAt?: string;
}

export interface ScheduleSessionRetryOptions extends SessionLifecycleOptions {
  attemptId: string;
  retryAt: string;
}

export async function scheduleSessionRetry(
  store: SessionStore,
  sessionId: string,
  options: ScheduleSessionRetryOptions,
): Promise<void> {
  const projection = await requireProjection(store, sessionId);
  if (isTerminalExecutionState(projection.state)) {
    throw new Error(`Cannot schedule a retry for terminal session ${sessionId}.`);
  }
  await store.append(sessionId, lifecycleEvent('retry.scheduled', options, {
    attemptId: options.attemptId,
    retryAt: options.retryAt,
    reason: options.reason,
  }), { expectedRevision: projection.revision });
}

export async function cancelSession(
  store: SessionStore,
  sessionId: string,
  options: SessionLifecycleOptions,
): Promise<void> {
  await transitionSession(store, sessionId, 'cancellation.requested', 'cancelled', options);
}

export async function expireSession(
  store: SessionStore,
  sessionId: string,
  options: SessionLifecycleOptions,
): Promise<void> {
  await transitionSession(store, sessionId, 'state.transitioned', 'expired', options);
}

export async function tombstoneSession(
  store: SessionStore,
  sessionId: string,
  options: SessionLifecycleOptions,
): Promise<void> {
  const projection = await requireProjection(store, sessionId);
  await store.append(sessionId, lifecycleEvent('session.tombstoned', options, {
    reason: options.reason,
  }, projection.state), { expectedRevision: projection.revision });
}

export async function purgeSession(store: SessionStore, sessionId: string): Promise<void> {
  const projection = await requireProjection(store, sessionId);
  if (!projection.tombstonedAt) throw new Error(`Session ${sessionId} must be tombstoned first.`);
  await store.purge(sessionId, { expectedRevision: projection.revision });
}

async function transitionSession(
  store: SessionStore,
  sessionId: string,
  type: string,
  state: 'cancelled' | 'expired',
  options: SessionLifecycleOptions,
): Promise<void> {
  const projection = await requireProjection(store, sessionId);
  await store.append(sessionId, lifecycleEvent(type, options, {
    reason: options.reason,
  }, state), { expectedRevision: projection.revision });
}

function lifecycleEvent(
  type: string,
  options: SessionLifecycleOptions,
  payload: Record<string, unknown>,
  state?: SessionEventInput['state'],
): SessionEventInput {
  const eventId = randomUUID();
  return {
    eventId,
    idempotencyKey: eventId,
    type,
    occurredAt: options.occurredAt ?? new Date().toISOString(),
    ...(state ? { state } : {}),
    ...(options.actor ? { actor: options.actor } : {}),
    payload,
  };
}

async function requireProjection(store: SessionStore, sessionId: string) {
  const projection = await store.getProjection(sessionId);
  if (!projection) throw new Error(`Session ${sessionId} was not found.`);
  return projection;
}
