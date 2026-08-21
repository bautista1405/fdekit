import { randomUUID } from 'crypto';
import type { ExecutionState } from '@fdekit/core';
import type { TraceEvent } from '../../traces/index.js';
import type { RunState } from './types.js';

const IMMEDIATE_EVENT_TYPES = new Set([
  'agent.run.started',
  'agent.run.completed',
  'approval.requested',
  'approval.resolved',
  'input.requested',
  'input.answered',
]);

/** Queue trace telemetry and flush it at lifecycle durability boundaries. */
export async function recordRunEvent(
  state: RunState,
  event: TraceEvent,
  executionState?: ExecutionState,
): Promise<void> {
  const sanitized = jsonRoundTrip(event);
  const { type, ...payload } = sanitized;
  const eventId = randomUUID();
  state.events.push(sanitized);
  state.pendingSessionEvents.push({
    eventId,
    idempotencyKey: eventId,
    type,
    occurredAt: new Date().toISOString(),
    ...(executionState ? { state: executionState } : {}),
    ...(Object.keys(payload).length > 0 ? { payload } : {}),
  });

  if (isDurabilityBoundary(type, executionState)) await flushRunEvents(state);
}

/** Flush queued events in one store transaction, with a sequential fallback for custom stores. */
export async function flushRunEvents(state: RunState): Promise<void> {
  const pending = state.pendingSessionEvents;
  if (pending.length === 0) return;

  if (state.sessionStore.appendBatch) {
    const result = await state.sessionStore.appendBatch(state.runId, pending, {
      expectedRevision: state.sessionRevision,
    });
    state.sessionRevision = result.projection.revision;
    state.sessionState = result.projection.state;
  } else {
    for (const event of pending) {
      const result = await state.sessionStore.append(state.runId, event, {
        expectedRevision: state.sessionRevision,
      });
      state.sessionRevision = result.projection.revision;
      state.sessionState = result.projection.state;
    }
  }
  state.pendingSessionEvents = [];
}

function isDurabilityBoundary(type: string, state?: ExecutionState): boolean {
  return IMMEDIATE_EVENT_TYPES.has(type)
    || state === 'needs_approval'
    || state === 'needs_input'
    || state === 'completed'
    || state === 'completed_with_limits'
    || state === 'failed'
    || state === 'cancelled'
    || state === 'expired';
}

function jsonRoundTrip(event: TraceEvent): TraceEvent {
  const serialized = JSON.stringify(event);
  if (serialized === undefined) {
    throw new Error('Trace events must be JSON-compatible.');
  }

  return JSON.parse(serialized) as TraceEvent;
}
