---
"@fdekit/core": patch
"@fdekit/runtime": patch
"@fdekit/cli": patch
"@fdekit/console": patch
---

Harden the human review loop end to end, fixing every issue from the 0.5.2 field report.

**Governance criticals**

- Approval fingerprints now include the execution target (connector name, mode, repository/channel/base URL). Approvals granted against simulated connectors no longer authorize live writes after a `FDEKIT_CONNECTOR_MODE=api` flip - the first live run pauses for fresh review. Existing approvals for connector tools are invalidated on upgrade by design.
- Failed tool calls are loud: runs finish as `completed_with_errors` (exit 1) with per-call `✗ tool: reason` lines in the run summary and `failedToolCalls` in the trace, instead of reporting unqualified success.

**Review loop convergence (resume semantics)**

- A run paused on an approval persists its state to `artifacts/runs/<runId>.json`. `fdekit run <agent> --resume [runId]` (new) executes the exact approved tool call - no re-planning, so live-provider nondeterminism cannot drift the approved args - and continues the loop with the restored history, so earlier writes are not replayed. Approve/resume now converges with any provider; `runtime` exports `resumeAgentRun`.
- `waiting_approval` exits with code 2 (distinct from failure); a rejected approval ends the run with new status `rejected` instead of a misleading `waiting_approval`.
- Approval artifacts record `executedAt`/`executedRunId` when the approved call actually runs.

**Approvals CLI**

- `fdekit approvals show <id>` (new): full args, target system, decision history, execution record.
- `approvals list` shows an args summary and target per request, supports `--status`, `--tool`, and `--json`.
- Decisions default `--by` to the OS username instead of `"fde"`; overturning a decision requires `--force`, and the artifact keeps the full decision history (`decisions[]`).

**Approval-aware evals**

- The eval runner auto-decides approval gates by default (recorded as `eval-runner`; cases with `expected.shouldProceed: false` auto-reject), so governed agents stay eval-able. `fdekit eval run --require-approvals` keeps production pause behavior.
- Waiting on an approval no longer counts as a policy violation, so `noPolicyViolation()` works under gating; new `approvalRequested(toolName?)` assertion lets evals assert *for* gating.
- `fdekit eval run` prints failing assertions inline instead of only "Eval status: failed".

**Console**

- The Engineer Review approval queue always includes pending approvals regardless of trace scope, so the page no longer contradicts `fdekit approvals list`; "open" counts mean pending only.

**support-triage recipe**

- The config now ships the promised `requireApproval` gate on `issue.create`/`slack.message`/`ticket.escalate`, and the demo walks the full pause -> approve -> resume cycle. The demo survives eval failures instead of crashing, and the README documents the review loop plus the mock-calibrated eval caveat.
- `recipe install` merges npm scripts instead of duplicating the init scaffold (`doctor` vs `fdekit:doctor`, ...); scaffold defaults like `eval` are upgraded in place.

**Runtime environments**

- `EnvironmentCommandDefinition.background` (new): `env start` runs the command detached with a pidfile and returns once health checks pass; `env stop` also stops recorded background processes. Foreground server commands that keep running while health checks pass get an explanatory hint instead of hanging silently.
- `env start` is idempotent (short-circuits when the environment is already healthy); signal-terminated commands are reported as failures instead of success; command-based health checks capture output and show it only on failure; `env doctor --json`; `env describe` lists health checks; unknown env flags are rejected.
- `fdekit validate` errors on health checks that define neither `url` nor `command`.

**Scaffold polish**

- `fdekit add policy <name>` scaffolds a working `beforeToolCall` skeleton with the allow/deny/approval contract instead of a silent no-op.
- The starter `workflow.md` rollout list renders as a proper Markdown ordered list.
