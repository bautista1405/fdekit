import { randomUUID } from 'node:crypto';
import {
  EXECUTION_CONTRACT_VERSION,
  isTerminalExecutionState,
  type ActorIdentity,
  type ExternalActionRecord,
  type PlannedAction,
  type WorkerLeasePurpose,
  type WorkerLeaseRecord,
} from '@fdekit/core';
import type {
  AppendSessionEventBatchResult,
  AppendSessionEventResult,
  SessionEventInput,
  SessionProjection,
  SessionStore,
} from './types.js';

export interface SessionLeaseToken {
  leaseId: string;
  epoch: number;
  owner: ActorIdentity;
}

export interface AcquireSessionLeaseOptions {
  owner: ActorIdentity;
  ttlMs: number;
  leaseId?: string;
  purpose?: WorkerLeasePurpose;
  now?: Date;
}

export interface AdvanceSessionLeaseOptions {
  lease: SessionLeaseToken;
  now?: Date;
}

export interface RenewSessionLeaseOptions extends AdvanceSessionLeaseOptions {
  ttlMs: number;
}

export class SessionLeaseConflictError extends Error {
  constructor(readonly sessionId: string, readonly lease: WorkerLeaseRecord) {
    super(`Session ${sessionId} is already leased by ${lease.owner.id} at epoch ${lease.epoch}.`);
    this.name = 'SessionLeaseConflictError';
  }
}

export class StaleSessionLeaseError extends Error {
  constructor(readonly sessionId: string, message: string) {
    super(`Session ${sessionId} rejected a stale worker lease: ${message}.`);
    this.name = 'StaleSessionLeaseError';
  }
}

export class ExternalActionConflictError extends Error {
  constructor(readonly actionId: string, message: string) {
    super(`External action ${actionId} conflicts with durable state: ${message}.`);
    this.name = 'ExternalActionConflictError';
  }
}

export class ExternalActionStateError extends Error {
  constructor(readonly actionId: string, readonly status: string, expected: string) {
    super(`External action ${actionId} is ${status}; expected ${expected}.`);
    this.name = 'ExternalActionStateError';
  }
}

export class ExternalActionReconciliationRequiredError extends Error {
  constructor(readonly actionId: string, readonly status: string) {
    super(
      `External action ${actionId} is already ${status}; reconcile or observe it before any dispatch.`,
    );
    this.name = 'ExternalActionReconciliationRequiredError';
  }
}

export async function acquireSessionLease(
  store: SessionStore,
  sessionId: string,
  options: AcquireSessionLeaseOptions,
): Promise<WorkerLeaseRecord> {
  assertPositiveTtl(options.ttlMs);
  const now = options.now ?? new Date();
  const projection = await requireProjection(store, sessionId);
  const purpose = options.purpose ?? 'execution';
  if (isTerminalExecutionState(projection.state) && purpose !== 'reconciliation') {
    throw new Error(`Terminal session ${sessionId} only admits a reconciliation lease.`);
  }

  const latest = await currentSessionLease(store, sessionId, now);
  const leaseId = options.leaseId ?? randomUUID();
  if (latest?.status === 'active') {
    if (latest.leaseId === leaseId && sameActor(latest.owner, options.owner)) return latest;
    throw new SessionLeaseConflictError(sessionId, latest);
  }

  const acquiredAt = now.toISOString();
  const lease: WorkerLeaseRecord = {
    schemaVersion: EXECUTION_CONTRACT_VERSION,
    leaseId,
    sessionId,
    owner: options.owner,
    epoch: (latest?.epoch ?? 0) + 1,
    purpose,
    acquiredAt,
    expiresAt: new Date(now.getTime() + options.ttlMs).toISOString(),
    status: 'active',
  };
  const result = await store.append(sessionId, coordinationEvent(
    'lease.acquired',
    `lease:${leaseId}:acquired`,
    acquiredAt,
    lease,
    options.owner,
  ), { expectedRevision: projection.revision });
  return result.event.payload as WorkerLeaseRecord;
}

export async function renewSessionLease(
  store: SessionStore,
  sessionId: string,
  options: RenewSessionLeaseOptions,
): Promise<WorkerLeaseRecord> {
  assertPositiveTtl(options.ttlMs);
  const now = options.now ?? new Date();
  const { lease, projection } = await requireCurrentLease(store, sessionId, options.lease, now);
  const renewed: WorkerLeaseRecord = {
    ...lease,
    expiresAt: new Date(now.getTime() + options.ttlMs).toISOString(),
    status: 'active',
  };
  const result = await store.append(sessionId, coordinationEvent(
    'lease.renewed',
    `lease:${lease.leaseId}:renewed:${renewed.expiresAt}`,
    now.toISOString(),
    renewed,
    options.lease.owner,
  ), { expectedRevision: projection.revision });
  return result.event.payload as WorkerLeaseRecord;
}

export async function releaseSessionLease(
  store: SessionStore,
  sessionId: string,
  options: AdvanceSessionLeaseOptions,
): Promise<WorkerLeaseRecord> {
  const now = options.now ?? new Date();
  const { lease, projection } = await requireCurrentLease(store, sessionId, options.lease, now);
  const released: WorkerLeaseRecord = {
    ...lease,
    status: 'released',
    releasedAt: now.toISOString(),
  };
  const result = await store.append(sessionId, coordinationEvent(
    'lease.released',
    `lease:${lease.leaseId}:released`,
    now.toISOString(),
    released,
    options.lease.owner,
  ), { expectedRevision: projection.revision });
  return result.event.payload as WorkerLeaseRecord;
}

export async function getCurrentSessionLease(
  store: SessionStore,
  sessionId: string,
  options: { now?: Date } = {},
): Promise<WorkerLeaseRecord | null> {
  return currentSessionLease(store, sessionId, options.now ?? new Date());
}

export async function assertSessionLease(
  store: SessionStore,
  sessionId: string,
  lease: SessionLeaseToken,
  options: { now?: Date } = {},
): Promise<WorkerLeaseRecord> {
  return (await requireCurrentLease(store, sessionId, lease, options.now ?? new Date())).lease;
}

export interface SessionCheckpointOptions<State> extends AdvanceSessionLeaseOptions {
  checkpoint: State;
}

export async function appendSessionCheckpoint<State>(
  store: SessionStore,
  sessionId: string,
  options: SessionCheckpointOptions<State>,
): Promise<AppendSessionEventResult> {
  const now = options.now ?? new Date();
  const { lease, projection } = await requireCurrentLease(store, sessionId, options.lease, now);
  return store.append(sessionId, coordinationEvent(
    'checkpoint.saved',
    `checkpoint:${lease.epoch}:${randomUUID()}`,
    now.toISOString(),
    { leaseId: lease.leaseId, fenceEpoch: lease.epoch, checkpoint: options.checkpoint },
    options.lease.owner,
  ), { expectedRevision: projection.revision });
}

export async function recordSessionHeartbeat(
  store: SessionStore,
  sessionId: string,
  options: AdvanceSessionLeaseOptions,
): Promise<AppendSessionEventResult> {
  const now = options.now ?? new Date();
  const { lease, projection } = await requireCurrentLease(store, sessionId, options.lease, now);
  return store.append(sessionId, coordinationEvent(
    'heartbeat.recorded',
    `heartbeat:${lease.leaseId}:${now.toISOString()}`,
    now.toISOString(),
    { leaseId: lease.leaseId, fenceEpoch: lease.epoch },
    options.lease.owner,
  ), { expectedRevision: projection.revision });
}

export interface PrepareExternalActionOptions extends AdvanceSessionLeaseOptions {
  action: PlannedAction;
}

export interface AdvanceExternalActionOptions extends AdvanceSessionLeaseOptions {
  actionId: string;
}

export interface ObserveExternalActionOptions extends AdvanceExternalActionOptions {
  providerEffectId: string;
  outcome?: string;
}

export interface ResolveExternalActionOptions extends AdvanceExternalActionOptions {
  outcome: string;
  providerEffectId?: string;
}

export async function prepareExternalAction(
  store: SessionStore,
  sessionId: string,
  options: PrepareExternalActionOptions,
): Promise<ExternalActionRecord> {
  const now = options.now ?? new Date();
  const { lease, projection } = await requireCurrentLease(store, sessionId, options.lease, now);
  assertAdmitsExternalAction(projection);
  if (options.action.identity.runId !== sessionId) {
    throw new ExternalActionConflictError(options.action.actionId, 'the action belongs to another session');
  }

  const actions = await readExternalActions(store, sessionId);
  const byKey = actions.find((record) => record.action.idempotencyKey === options.action.idempotencyKey);
  if (byKey) {
    assertSameAction(byKey.action, options.action);
    return latestActionRecord(actions, byKey.action.actionId) as ExternalActionRecord;
  }
  const byId = latestActionRecord(actions, options.action.actionId);
  if (byId) throw new ExternalActionConflictError(options.action.actionId, 'the action id is already in use');

  const preparedAt = now.toISOString();
  const record: ExternalActionRecord = {
    schemaVersion: EXECUTION_CONTRACT_VERSION,
    sessionId,
    action: options.action,
    status: 'prepared',
    leaseId: lease.leaseId,
    fenceEpoch: lease.epoch,
    preparedAt,
    updatedAt: preparedAt,
  };
  return appendAction(store, sessionId, projection, options.lease.owner, 'action.prepared', record);
}

export async function dispatchExternalAction(
  store: SessionStore,
  sessionId: string,
  options: AdvanceExternalActionOptions,
): Promise<ExternalActionRecord> {
  const now = options.now ?? new Date();
  const context = await actionContext(store, sessionId, options, now);
  if (context.action.status === 'dispatched' || context.action.status === 'uncertain') {
    throw new ExternalActionReconciliationRequiredError(options.actionId, context.action.status);
  }
  assertAdmitsExternalAction(context.projection);
  assertActionStatus(context.action, 'prepared');
  return appendActionUpdate(store, sessionId, context, options.lease.owner, 'action.dispatched', 'dispatched', now);
}

export async function observeExternalAction(
  store: SessionStore,
  sessionId: string,
  options: ObserveExternalActionOptions,
): Promise<ExternalActionRecord> {
  const now = options.now ?? new Date();
  const context = await actionContext(store, sessionId, options, now);
  if (context.action.status === 'observed' && context.action.providerEffectId === options.providerEffectId) {
    return context.action;
  }
  assertActionStatus(context.action, 'dispatched');
  return appendActionUpdate(
    store,
    sessionId,
    context,
    options.lease.owner,
    'action.observed',
    'observed',
    now,
    { providerEffectId: options.providerEffectId, ...(options.outcome ? { outcome: options.outcome } : {}) },
  );
}

export async function commitExternalAction(
  store: SessionStore,
  sessionId: string,
  options: AdvanceExternalActionOptions,
): Promise<ExternalActionRecord> {
  const now = options.now ?? new Date();
  const context = await actionContext(store, sessionId, options, now);
  if (context.action.status === 'committed') return context.action;
  assertActionStatus(context.action, 'observed');
  return appendActionUpdate(store, sessionId, context, options.lease.owner, 'action.committed', 'committed', now);
}

export async function markExternalActionUncertain(
  store: SessionStore,
  sessionId: string,
  options: ResolveExternalActionOptions,
): Promise<ExternalActionRecord> {
  const now = options.now ?? new Date();
  const context = await actionContext(store, sessionId, options, now);
  if (context.action.status === 'uncertain' && context.action.outcome === options.outcome) return context.action;
  assertActionStatus(context.action, 'dispatched');
  return appendActionUpdate(
    store,
    sessionId,
    context,
    options.lease.owner,
    'action.uncertain',
    'uncertain',
    now,
    { outcome: options.outcome },
    'reconciling',
  );
}

export async function reconcileExternalAction(
  store: SessionStore,
  sessionId: string,
  options: ResolveExternalActionOptions,
): Promise<ExternalActionRecord> {
  const now = options.now ?? new Date();
  const context = await actionContext(store, sessionId, options, now);
  if (context.action.status === 'reconciled') return context.action;
  assertActionStatus(context.action, 'uncertain');
  return appendActionUpdate(
    store,
    sessionId,
    context,
    options.lease.owner,
    'action.reconciled',
    'reconciled',
    now,
    {
      outcome: options.outcome,
      ...(options.providerEffectId ? { providerEffectId: options.providerEffectId } : {}),
    },
    context.projection.state === 'reconciling' ? 'running' : undefined,
  );
}

/** Record a provider-confirmed action failure; ambiguous failures must be marked uncertain first. */
export async function failExternalAction(
  store: SessionStore,
  sessionId: string,
  options: ResolveExternalActionOptions,
): Promise<ExternalActionRecord> {
  const now = options.now ?? new Date();
  const context = await actionContext(store, sessionId, options, now);
  if (context.action.status === 'failed') return context.action;
  if (context.action.status !== 'dispatched'
    && context.action.status !== 'observed'
    && context.action.status !== 'uncertain') {
    throw new ExternalActionStateError(
      context.action.action.actionId,
      context.action.status,
      'dispatched, observed, or uncertain',
    );
  }
  return appendActionUpdate(
    store,
    sessionId,
    context,
    options.lease.owner,
    'action.failed',
    'failed',
    now,
    {
      outcome: options.outcome,
      ...(options.providerEffectId ? { providerEffectId: options.providerEffectId } : {}),
    },
    isTerminalExecutionState(context.projection.state) ? undefined : 'failed',
  );
}

export interface SessionMessageOptions<Payload> {
  messageId: string;
  idempotencyKey: string;
  payload: Payload;
  actor?: ActorIdentity;
  occurredAt?: string;
}

export function recordSessionInbox<Payload>(
  store: SessionStore,
  sessionId: string,
  options: SessionMessageOptions<Payload>,
): Promise<AppendSessionEventResult> {
  return appendMessage(store, sessionId, 'inbox.received', options);
}

export function enqueueSessionOutbox<Payload>(
  store: SessionStore,
  sessionId: string,
  options: SessionMessageOptions<Payload>,
): Promise<AppendSessionEventResult> {
  return appendMessage(store, sessionId, 'outbox.enqueued', options);
}

/**
 * Atomically append a domain transition and its outbox message.
 * Stores without a transactional batch boundary are rejected rather than
 * silently weakening delivery semantics.
 */
export async function appendSessionEventWithOutbox<Payload>(
  store: SessionStore,
  sessionId: string,
  domainEvent: SessionEventInput,
  message: SessionMessageOptions<Payload>,
): Promise<AppendSessionEventBatchResult> {
  if (!store.appendBatch) {
    throw new Error('Transactional session outbox requires SessionStore.appendBatch().');
  }
  const projection = await requireProjection(store, sessionId);
  const occurredAt = message.occurredAt ?? new Date().toISOString();
  const outboxEvent: SessionEventInput = {
    ...coordinationEvent(
      'outbox.enqueued',
      message.idempotencyKey,
      occurredAt,
      { messageId: message.messageId, payload: message.payload },
      message.actor,
    ),
    eventId: `outbox.enqueued:${message.messageId}`,
  };
  return store.appendBatch(sessionId, [domainEvent, outboxEvent], {
    expectedRevision: projection.revision,
  });
}

export interface DeliverSessionOutboxOptions {
  messageId: string;
  /** The idempotency key used when the message was enqueued. */
  idempotencyKey: string;
  actor?: ActorIdentity;
  occurredAt?: string;
}

export async function markSessionOutboxDelivered(
  store: SessionStore,
  sessionId: string,
  options: DeliverSessionOutboxOptions,
): Promise<AppendSessionEventResult> {
  const projection = await requireProjection(store, sessionId);
  const events = await store.readEvents<{ messageId?: string }>(sessionId);
  const enqueued = events.find((candidate) =>
    candidate.type === 'outbox.enqueued'
    && candidate.idempotencyKey === options.idempotencyKey
    && candidate.payload?.messageId === options.messageId,
  );
  if (!enqueued) throw new Error(`Outbox message ${options.messageId} was not enqueued.`);
  const occurredAt = options.occurredAt ?? new Date().toISOString();
  return store.append(sessionId, {
    ...coordinationEvent(
      'outbox.delivered',
      `${options.idempotencyKey}:delivered`,
      occurredAt,
      { messageId: options.messageId, enqueuedEventId: enqueued.eventId },
      options.actor,
    ),
    eventId: `outbox-delivered:${options.messageId}`,
  }, { expectedRevision: projection.revision });
}

async function appendMessage<Payload>(
  store: SessionStore,
  sessionId: string,
  type: 'inbox.received' | 'outbox.enqueued',
  options: SessionMessageOptions<Payload>,
): Promise<AppendSessionEventResult> {
  const projection = await requireProjection(store, sessionId);
  const occurredAt = options.occurredAt ?? new Date().toISOString();
  return store.append(sessionId, {
    ...coordinationEvent(
      type,
      options.idempotencyKey,
      occurredAt,
      { messageId: options.messageId, payload: options.payload },
      options.actor,
    ),
    eventId: `${type}:${options.messageId}`,
  }, { expectedRevision: projection.revision });
}

interface ActionContext {
  action: ExternalActionRecord;
  lease: WorkerLeaseRecord;
  projection: SessionProjection;
}

async function actionContext(
  store: SessionStore,
  sessionId: string,
  options: AdvanceExternalActionOptions,
  now: Date,
): Promise<ActionContext> {
  const { lease, projection } = await requireCurrentLease(store, sessionId, options.lease, now);
  const action = latestActionRecord(await readExternalActions(store, sessionId), options.actionId);
  if (!action) throw new ExternalActionConflictError(options.actionId, 'the action was not prepared');
  return { action, lease, projection };
}

async function appendActionUpdate(
  store: SessionStore,
  sessionId: string,
  context: ActionContext,
  actor: ActorIdentity,
  eventType: string,
  status: ExternalActionRecord['status'],
  now: Date,
  details: Partial<Pick<ExternalActionRecord, 'providerEffectId' | 'outcome'>> = {},
  state?: SessionEventInput['state'],
): Promise<ExternalActionRecord> {
  const record: ExternalActionRecord = {
    ...context.action,
    ...details,
    status,
    leaseId: context.lease.leaseId,
    fenceEpoch: context.lease.epoch,
    updatedAt: now.toISOString(),
  };
  return appendAction(store, sessionId, context.projection, actor, eventType, record, state);
}

async function appendAction(
  store: SessionStore,
  sessionId: string,
  projection: SessionProjection,
  actor: ActorIdentity,
  eventType: string,
  record: ExternalActionRecord,
  state?: SessionEventInput['state'],
): Promise<ExternalActionRecord> {
  const result = await store.append(sessionId, {
    ...coordinationEvent(
      eventType,
      `action:${record.action.idempotencyKey}:${record.status}`,
      record.updatedAt,
      record,
      actor,
    ),
    ...(state ? { state } : {}),
    identity: record.action.identity,
  }, { expectedRevision: projection.revision });
  return result.event.payload as ExternalActionRecord;
}

async function readExternalActions(
  store: SessionStore,
  sessionId: string,
): Promise<ExternalActionRecord[]> {
  const events = await store.readEvents<unknown>(sessionId);
  return events.flatMap((event) => isExternalActionRecord(event.payload) ? [event.payload] : []);
}

function latestActionRecord(
  records: readonly ExternalActionRecord[],
  actionId: string,
): ExternalActionRecord | undefined {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record?.action.actionId === actionId) return record;
  }
  return undefined;
}

async function currentSessionLease(
  store: SessionStore,
  sessionId: string,
  now: Date,
): Promise<WorkerLeaseRecord | null> {
  const events = await store.readEvents<unknown>(sessionId);
  let latest: unknown;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (isWorkerLeaseRecord(events[index]?.payload)) {
      latest = events[index]?.payload;
      break;
    }
  }
  if (!isWorkerLeaseRecord(latest)) return null;
  if (latest.status === 'active' && Date.parse(latest.expiresAt) <= now.getTime()) {
    return { ...latest, status: 'expired' };
  }
  return latest;
}

async function requireCurrentLease(
  store: SessionStore,
  sessionId: string,
  token: SessionLeaseToken,
  now: Date,
): Promise<{ lease: WorkerLeaseRecord; projection: SessionProjection }> {
  const projection = await requireProjection(store, sessionId);
  const lease = await currentSessionLease(store, sessionId, now);
  if (!lease) throw new StaleSessionLeaseError(sessionId, 'no lease exists');
  if (lease.status !== 'active') throw new StaleSessionLeaseError(sessionId, `lease ${lease.leaseId} is ${lease.status}`);
  if (lease.leaseId !== token.leaseId || lease.epoch !== token.epoch) {
    throw new StaleSessionLeaseError(sessionId, `current epoch is ${lease.epoch}`);
  }
  if (!sameActor(lease.owner, token.owner)) {
    throw new StaleSessionLeaseError(sessionId, `lease owner is ${lease.owner.id}`);
  }
  return { lease, projection };
}

function assertAdmitsExternalAction(projection: SessionProjection): void {
  if (projection.state !== 'planning' && projection.state !== 'running') {
    throw new Error(`Session ${projection.sessionId} in state ${projection.state} does not admit new external actions.`);
  }
}

function assertActionStatus(record: ExternalActionRecord, expected: ExternalActionRecord['status']): void {
  if (record.status !== expected) throw new ExternalActionStateError(record.action.actionId, record.status, expected);
}

function assertSameAction(existing: PlannedAction, candidate: PlannedAction): void {
  const fields: Array<keyof PlannedAction> = [
    'actionId', 'capability', 'target', 'operation', 'argumentsDigest', 'idempotencyKey',
  ];
  if (fields.some((field) => existing[field] !== candidate[field])
    || existing.identity.runId !== candidate.identity.runId) {
    throw new ExternalActionConflictError(candidate.actionId, 'the idempotency key maps to different immutable inputs');
  }
}

function coordinationEvent<Payload>(
  type: string,
  idempotencyKey: string,
  occurredAt: string,
  payload: Payload,
  actor?: ActorIdentity,
): SessionEventInput<Payload> {
  return {
    eventId: randomUUID(),
    idempotencyKey,
    type,
    occurredAt,
    ...(actor ? { actor } : {}),
    payload,
  };
}

async function requireProjection(store: SessionStore, sessionId: string): Promise<SessionProjection> {
  const projection = await store.getProjection(sessionId);
  if (!projection) throw new Error(`Session ${sessionId} was not found.`);
  return projection;
}

function sameActor(left: ActorIdentity, right: ActorIdentity): boolean {
  return left.id === right.id && left.kind === right.kind;
}

function assertPositiveTtl(ttlMs: number): void {
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new Error('Session lease ttlMs must be a positive safe integer.');
  }
}

function isWorkerLeaseRecord(value: unknown): value is WorkerLeaseRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkerLeaseRecord>;
  return candidate.schemaVersion === EXECUTION_CONTRACT_VERSION
    && typeof candidate.leaseId === 'string'
    && typeof candidate.sessionId === 'string'
    && typeof candidate.epoch === 'number'
    && typeof candidate.expiresAt === 'string'
    && (candidate.status === 'active' || candidate.status === 'released' || candidate.status === 'expired');
}

function isExternalActionRecord(value: unknown): value is ExternalActionRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExternalActionRecord>;
  return candidate.schemaVersion === EXECUTION_CONTRACT_VERSION
    && typeof candidate.sessionId === 'string'
    && typeof candidate.action?.actionId === 'string'
    && typeof candidate.status === 'string'
    && typeof candidate.fenceEpoch === 'number';
}
