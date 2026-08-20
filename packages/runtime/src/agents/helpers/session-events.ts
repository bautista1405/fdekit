import { randomUUID } from 'crypto';
import type { ExecutionState } from '@fdekit/core';
import type { TraceEvent } from '../../traces/index.js';
import type { RunState } from './types.js';

/** Append a trace event to both the in-memory result and the durable session log. */
export async function recordRunEvent(
  state: RunState,
  event: TraceEvent,
  executionState?: ExecutionState,
): Promise<void> {
  const sanitized = jsonRoundTrip(event);
  const { type, ...payload } = sanitized;
  const eventId = randomUUID();
  const result = await state.sessionStore.append(
    state.runId,
    {
      eventId,
      idempotencyKey: eventId,
      type,
      occurredAt: new Date().toISOString(),
      ...(executionState ? { state: executionState } : {}),
      ...(Object.keys(payload).length > 0 ? { payload } : {}),
    },
    { expectedRevision: state.sessionRevision },
  );

  state.sessionRevision = result.projection.revision;
  state.sessionState = result.projection.state;
  state.events.push(sanitized);
}

function jsonRoundTrip(event: TraceEvent): TraceEvent {
  const serialized = JSON.stringify(event);
  if (serialized === undefined) {
    throw new Error('Trace events must be JSON-compatible.');
  }

  return JSON.parse(serialized) as TraceEvent;
}
