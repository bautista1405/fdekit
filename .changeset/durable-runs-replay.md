---
'@fdekit/runtime': patch
---

Add the versioned append-only `SessionStore`, a durable local JSONL
implementation with optimistic revisions, idempotent appends, immutable
snapshots, state-transition validation, and live agent-run event recording.
