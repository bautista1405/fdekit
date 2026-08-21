# Session Store and Local Run State

`@fdekit/runtime/sessions` defines the durable session seam shared by local
Community runs and injected commercial implementations. It does not expose an
HTTP server or daemon.

## Source of truth

Each local session is stored under
`artifacts/sessions/<sessionId>/events.jsonl`. The append-only log is the source
of truth. `projection.json` is a small convenience cache and must never be used
to recover state without validating or replaying the log.

Every event has:

- protocol version, session ID, sequence, event ID, and idempotency key;
- logical and recorded timestamps;
- an optional canonical execution state;
- JSON-compatible payload and metadata;
- a SHA-256 content digest.

Agent runs commit their start immediately, batch non-critical planning and
telemetry events, and flush the ordered batch at approval, input, failure, and
terminal lifecycle boundaries. `appendBatch()` performs one lock, append,
`fsync`, and projection update; custom stores without it receive the same
events sequentially. The final trace artifact is a projection of that event
sequence.

## Concurrency and retries

`append()` accepts `expectedRevision`. The file implementation uses a
cross-process lock directory and rejects competing compare-and-append writers
with `SessionRevisionConflictError`. A retry with the same idempotency key and
content returns the prior event; reusing that key for different content fails.

The state machine accepts only the vocabulary exported by `@fdekit/core`.
Terminal states cannot return to active states. `needs_input`,
`needs_approval`, and `reconciling` are durable states rather than UI labels.
Structured input requests persist their JSON schema and disclosure class. A
resume without an answer stays paused, and a schema-invalid answer cannot
consume the pause. Optional gates can also persist intended principals, a
deadline, and only the digest of a one-time resume capability. Explicit helpers
schedule retries, cancel or expire active
sessions, tombstone retained sessions, and purge only after tombstoning.

## Worker leases and fencing

`acquireSessionLease()` records an owner, purpose, expiry, and monotonically
increasing fencing epoch. Concurrent acquisition uses the session revision so
only one contender commits. Renewal, release, heartbeat, checkpoint, and
external-action helpers require the current lease ID, epoch, and owner; an
expired or replaced worker receives `StaleSessionLeaseError` before it can
append executable state. Terminal sessions admit only reconciliation leases.

These primitives define worker coordination; they are not a queue. Queue
selection, backpressure, placement, and fleet operation remain host concerns.

## Restart and reconciliation

Snapshots are immutable per revision and contain their own checksum. They can
accelerate recovery, but the log remains authoritative and is retained.
External actions use the durable lifecycle `prepared -> dispatched -> observed
-> committed`, `dispatched -> uncertain -> reconciled`, or a
provider-confirmed transition to `failed`. Each record contains
the immutable `PlannedAction`, stable idempotency key, lease ID, and fencing
epoch. Dispatch is rejected from waiting or terminal sessions. A repeated
dispatch after `dispatched` or `uncertain` fails with
`ExternalActionReconciliationRequiredError`; a replacement worker must query
the provider using the stable identity and record the observed outcome.

Inbox and outbox helpers use the same idempotent event protocol.
`appendSessionEventWithOutbox()` atomically commits a domain event and its
outbox message through `SessionStore.appendBatch()` and rejects stores that do
not offer that boundary. Delivery is recorded separately and consumers remain
idempotent.

The local implementation proves event replay, optimistic concurrency,
idempotency across process restart, immutable snapshots, corruption detection,
terminal transitions, tombstones, concurrent lease fencing, stale-worker
rejection, atomic outbox append, and in-doubt action reconciliation. Hosted
retention/deletion, queue operation, and a tenant-isolated multi-worker
`SessionStore` implementation belong behind this interface in the private
service.
