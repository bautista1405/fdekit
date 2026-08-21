# Shared Execution Contracts

FDEKit Community and commercial runtimes use the same JSON-compatible contracts
from `@fdekit/core`. The current contract version is
`EXECUTION_CONTRACT_VERSION`.

## Identity and state

An exact execution is identified by `taskId`, `runId`, `attemptId`, and
`stepId`. `EXECUTION_STATES` is the canonical CLI and web vocabulary; consumers
must not invent additional persisted states. Terminal-state and version guards
are exported for protocol boundaries.

Task, run, attempt, and step records are distinct so retries do not overwrite
prior attempts. Timestamps are ISO 8601 strings at serialization boundaries.

## Context boundary

`ContextEnvelope` is host-only control state. Tenant, actor, policy, provenance,
trace, source permissions, and budgets remain outside provider serialization.
Only `ContextEnvelope.model` may be sent to a model. `ModelContext` is an
allowlist of instructions, evidence, memory, skills, tool schemas, and recent
actions; credentials and host internals have no fields on that type.

## Effects and pauses

`PlannedAction` binds an effect to an exact execution, source snapshots,
arguments digest, capability, target, and idempotency key. Approval decisions
bind to that planned-action digest. A changed source revision or argument set
therefore requires a new action and approval.

`ApprovalRequestRecord` and `InputRequestRecord` represent durable paused work,
not transient UI notifications. Input requests carry a JSON Schema and can
declare audience, disclosure, deadline, default, and a resume-token digest.

## Evidence

Artifacts have stable IDs, immutable numeric versions, checksums, producer
identity, and optional source lineage. Provenance distinguishes observed,
inferred, and human-confirmed claims. `UsageMeasurement` records unknown,
estimated, or measured token, latency, tool, and cost data without manufacturing
missing values.

These types define compatibility and evidence shape. Durable append-only session
storage, delivery retries, and action reconciliation are separate runtime
responsibilities.
