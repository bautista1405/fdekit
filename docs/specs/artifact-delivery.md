# Durable Artifact Delivery

The synchronous `ArtifactStore` HTTP adapter remains useful for direct control
plane operations, but durable evidence delivery uses the separate
`ArtifactDeliveryQueue` protocol.

## Producer contract

A producer assigns a stable `artifactId`, monotonically increasing positive
`version`, and idempotency key. It enqueues the complete immutable envelope
before attempting network delivery. Each envelope contains:

- protocol and producer/schema versions;
- artifact ID, version, logical ref, operation, encoding, and content type;
- exact contents plus SHA-256 checksum and envelope digest;
- optional execution identity and immutable source snapshots;
- creation time and caller metadata.

Reusing an artifact/version or idempotency key with different content fails.
Version gaps fail locally rather than creating an ambiguous remote history.

## Delivery and recovery

`createFileArtifactDeliveryQueue()` writes immutable envelopes under
`artifacts/delivery-spool`. `flush()` sends versions in order per artifact and
continues independent artifacts after a partial failure. A failed or
out-of-order version blocks later versions of only that artifact.

Accepted and duplicate acknowledgements become immutable checksummed receipts.
Every attempt is appended to an attempt log. Pending work is derived from
envelopes without receipts, so process restart cannot erase the retry set.

The receiver must enforce idempotency, checksum identity, tenant authorization,
and per-artifact ordering. `createHttpArtifactDeliveryTarget()` sends protocol
and idempotency headers and validates that the acknowledgement exactly matches
the envelope. An `out_of_order` acknowledgement includes `expectedVersion` and
leaves the envelope pending for reconciliation.

This queue is explicit rather than silently changing every `ArtifactStore`
write. Callers must enqueue evidence that requires delivery guarantees and
operate or invoke `flush()` until no pending envelopes remain.
