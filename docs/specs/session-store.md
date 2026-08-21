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

Agent runs append their trace events as work happens. The final trace artifact
is a projection of the same event sequence, so a separate local process can
read an addressed run before it finishes.

## Concurrency and retries

`append()` accepts `expectedRevision`. The file implementation uses a
cross-process lock directory and rejects competing compare-and-append writers
with `SessionRevisionConflictError`. A retry with the same idempotency key and
content returns the prior event; reusing that key for different content fails.

The state machine accepts only the vocabulary exported by `@fdekit/core`.
Terminal states cannot return to active states. `needs_input`,
`needs_approval`, and `reconciling` are durable states rather than UI labels.

## Restart and reconciliation

Snapshots are immutable per revision and contain their own checksum. They can
accelerate recovery, but the log remains authoritative and is retained. An
external action should record its planned identity and fence token before the
effect, then record `action.committed`, `action.uncertain`, or
`action.reconciled`. On restart, an uncertain action is reconciled against the
external system before any retry.

The local implementation proves event replay, optimistic concurrency,
idempotency across process restart, immutable snapshots, corruption detection,
terminal transitions, tombstones, and in-doubt action reconciliation. Queue
leases, hosted retention/deletion, and a multi-worker `SessionStore`
implementation belong behind this interface in the private service.
