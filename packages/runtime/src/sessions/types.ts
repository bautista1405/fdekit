import type { ActorIdentity, ExecutionIdentity, ExecutionState } from '@fdekit/core';

export const SESSION_PROTOCOL_VERSION = 1 as const;

export const SESSION_EVENT_TYPES = [
  'session.created',
  'state.transitioned',
  'checkpoint.saved',
  'heartbeat.recorded',
  'lease.acquired',
  'lease.renewed',
  'lease.released',
  'cancellation.requested',
  'retry.scheduled',
  'approval.requested',
  'approval.resolved',
  'approval.revised',
  'input.requested',
  'input.answered',
  'action.planned',
  'action.prepared',
  'action.started',
  'action.dispatched',
  'action.observed',
  'action.committed',
  'action.uncertain',
  'action.reconciled',
  'action.failed',
  'artifact.linked',
  'outbox.enqueued',
  'outbox.delivered',
  'inbox.received',
  'snapshot.written',
  'session.tombstoned',
] as const;

export type StandardSessionEventType = (typeof SESSION_EVENT_TYPES)[number];
export type SessionEventType = StandardSessionEventType | (string & {});

export interface SessionEventInput<Payload = unknown> {
  eventId: string;
  idempotencyKey: string;
  type: SessionEventType;
  occurredAt: string;
  /** State after this event. Omit for an observation that does not transition state. */
  state?: ExecutionState;
  identity?: Partial<ExecutionIdentity>;
  actor?: ActorIdentity;
  payload?: Payload;
  metadata?: Record<string, unknown>;
}

export interface SessionEvent<Payload = unknown> extends SessionEventInput<Payload> {
  schemaVersion: typeof SESSION_PROTOCOL_VERSION;
  sessionId: string;
  sequence: number;
  recordedAt: string;
  /** SHA-256 of the logical input, used to reject conflicting idempotent retries. */
  contentDigest: string;
}

export interface SessionProjection {
  schemaVersion: typeof SESSION_PROTOCOL_VERSION;
  sessionId: string;
  revision: number;
  eventCount: number;
  state: ExecutionState;
  createdAt: string;
  updatedAt: string;
  lastEventId: string;
  identity?: Partial<ExecutionIdentity>;
  tombstonedAt?: string;
}

export interface SessionSnapshot<State = unknown> {
  schemaVersion: typeof SESSION_PROTOCOL_VERSION;
  sessionId: string;
  revision: number;
  executionState: ExecutionState;
  createdAt: string;
  state: State;
  contentDigest: string;
}

export interface AppendSessionEventOptions {
  /** Compare-and-append guard. Zero means the session must not exist yet. */
  expectedRevision?: number;
}

export interface ReadSessionEventsOptions {
  afterRevision?: number;
  limit?: number;
}

export interface AppendSessionEventResult<Payload = unknown> {
  event: SessionEvent<Payload>;
  projection: SessionProjection;
  /** False when an identical idempotency key was already committed. */
  appended: boolean;
}

export interface AppendSessionEventBatchResult {
  events: SessionEvent[];
  projection: SessionProjection;
  appendedCount: number;
}

export interface WriteSessionSnapshotOptions {
  expectedRevision: number;
}

export interface PurgeSessionOptions {
  expectedRevision?: number;
}

export interface SessionStore {
  append<Payload = unknown>(
    sessionId: string,
    event: SessionEventInput<Payload>,
    options?: AppendSessionEventOptions,
  ): Promise<AppendSessionEventResult<Payload>>;

  /** Commit several ordered events with one durability boundary. */
  appendBatch?(
    sessionId: string,
    events: SessionEventInput[],
    options?: AppendSessionEventOptions,
  ): Promise<AppendSessionEventBatchResult>;

  readEvents<Payload = unknown>(
    sessionId: string,
    options?: ReadSessionEventsOptions,
  ): Promise<Array<SessionEvent<Payload>>>;

  getProjection(sessionId: string): Promise<SessionProjection | null>;

  writeSnapshot<State = unknown>(
    sessionId: string,
    state: State,
    options: WriteSessionSnapshotOptions,
  ): Promise<SessionSnapshot<State>>;

  readLatestSnapshot<State = unknown>(sessionId: string): Promise<SessionSnapshot<State> | null>;

  /** Permanently remove a tombstoned session. */
  purge(sessionId: string, options?: PurgeSessionOptions): Promise<void>;
}

export interface FileSessionStoreOptions {
  projectDir: string;
  /** Defaults to `artifacts/sessions` relative to projectDir. */
  rootDir?: string;
  lockTimeoutMs?: number;
  staleLockMs?: number;
  now?: () => Date;
}
