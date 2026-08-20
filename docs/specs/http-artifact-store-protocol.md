# HTTP Artifact Store Protocol

Status: experimental protocol version 1.

The `@fdekit/runtime/artifacts` HTTP adapter sends execution evidence to a control plane without coupling recipes or agents to that control plane. The protocol covers transport operations only. Trace, review, eval, approval, and other artifact bodies retain their own schemas and versions.

## Authentication and metadata

Every request uses a deployment-scoped bearer token and sends:

```http
Authorization: Bearer <worker token>
X-FDEKit-Artifact-Protocol: 1
X-FDEKit-Artifact-Producer: @fdekit/runtime@<package version>
```

Write bodies also contain:

```json
{
  "protocolVersion": 1,
  "producer": {
    "name": "@fdekit/runtime",
    "version": "0.x.y"
  }
}
```

Receivers must authenticate the token and independently authorize the deployment, artifact group/type, size, and operation. Producer metadata is diagnostic and compatibility information, not identity or authority.

## Operations

`POST /artifacts` writes or replaces one logical reference:

```json
{
  "protocolVersion": 1,
  "producer": { "name": "@fdekit/runtime", "version": "0.x.y" },
  "operation": "put",
  "group": "traces",
  "fileName": "trace-123.json",
  "encoding": "json",
  "contents": "{\"id\":\"trace-123\"}"
}
```

`encoding` is `json` or `text`. JSON contents are serialized once and transported as a string.

`POST /artifacts/append` appends one JSONL line without a read-modify-write cycle:

```json
{
  "protocolVersion": 1,
  "producer": { "name": "@fdekit/runtime", "version": "0.x.y" },
  "operation": "append",
  "group": "audit",
  "fileName": "audit.jsonl",
  "encoding": "jsonl",
  "line": "{\"id\":\"event-123\"}"
}
```

`GET /artifacts?group=<group>&fileName=<file>` returns `{ "protocolVersion": 1, "contents": "..." }`. A `404` means the artifact has not been written. Omitting `fileName` returns `{ "protocolVersion": 1, "artifacts": [{ "contents": "..." }] }`.

Readers accept responses with no `protocolVersion` for compatibility with the initial experimental endpoint. An explicitly different version is rejected. Receivers should reject unsupported write versions instead of guessing, preserve fields they do not interpret, and avoid letting one malformed stored artifact hide an otherwise readable listing.

## Durability boundary

Direct protocol version 1 operations do not promise durable delivery or immutable
evidence history. The direct client performs synchronous requests and surfaces
failures, but a successful response acknowledges only that individual operation
according to the receiver's implementation.

Evidence requiring worker/network-failure guarantees uses the separate
[Durable Artifact Delivery](./artifact-delivery.md) protocol. It adds stable
artifact IDs, immutable versions, checksums, a local restart-safe spool,
idempotency, receipts, attempt history, and partial/out-of-order reconciliation.
The queue remains explicit: direct adapter calls retain their original
synchronous semantics, and mutable logical references are not retroactively
treated as immutable evidence.
