# @fdekit/runtime

## 0.6.0

### Minor Changes

- Align every published @fdekit package on a single version. `@fdekit/catalog` supplies the version that `fdekit init` and `fdekit recipe install` pin scaffolded projects to, and it had drifted ahead to 0.6.0 while the runtime packages stayed on 0.5.6. Scaffolds pinned a version that was never published, so `npm install` failed with `ETARGET` in every new project. The catalog now sits in the changesets fixed group and versions with everything else.

## 0.5.6

### Patch Changes

- fa9b821: Scope approval decisions to one exact run, and keep the credential-free CLI demos aligned with durable approval and resume behavior.
  - @fdekit/core@0.5.6

## 0.5.5

### Patch Changes

- 0aef42f: Add a correct-before-approve flow that validates replacement tool arguments,
  supersedes the pending request, issues a fresh exact approval fingerprint, and
  resumes only against the corrected request.
- 98a9a9b: Add decoupled inference target and endpoint capability contracts, pre-retrieval
  source authorization, policy-aware per-step context planning, budgeted
  tool/skill selection, selected/excluded manifests, and allowlisted provider
  serialization.
- eebfa56: Add context deduplication, explicit compression variants, compression evidence, cumulative runtime budget checks, and delegation-slot reservation.
- b782405: Add immutable versioned artifact delivery envelopes, a durable local spool,
  idempotent restart-safe retries, checksummed receipts, ordered partial-failure
  handling, and a versioned HTTP delivery target.
- cc7d8d5: Add the versioned append-only `SessionStore`, a durable local JSONL
  implementation with optimistic revisions, idempotent appends, immutable
  snapshots, state-transition validation, and live agent-run event recording.
- c1bb2cd: Add exact governed tool sequences with policy, approval, audit, trace, durable
  multi-approval resume, and no provider re-planning; migrate the graded codebase
  review delivery path away from direct connector handler calls.
- eebfa56: Add optional intended-principal, disclosure, deadline, and one-time capability
  gates for durable human input without persisting raw resume tokens.
- b145c5f: Add local source-aware chunking and authorized exact/full-text/vector/hybrid
  retrieval, scoped working/episodic memory, provenance-aware entity knowledge,
  policy/tenant/source-safe exact caching, and explicit cost/usage ledgers.
- 1933233: Add versioned project-local skill manifests, effective-policy subset grants,
  safe manifest validation, and an integrity-checking local loader that never
  executes skill code.
- eebfa56: Normalize provider-reported token usage, pass runtime output-token limits into
  built-in provider requests, record measured or explicitly unknown usage for
  every inference step, estimate declared target cost, and enforce hard cost
  budgets without inventing unavailable telemetry. Normalized totals include
  provider-specific reasoning and cache activity, with optional cache-write
  pricing for exact budget enforcement.
- eebfa56: Make policy-aware context plans load-bearing in agent runs by routing through
  selected inference endpoints and models, exposing only compiled model context
  to provider planners, enforcing planned tool and duration budgets, recording
  redacted durable plan evidence, and preserving plans across approval resume.
- 5e07466: Integrate execution backends with governed tools and add a hardened network-disabled Docker execution backend for isolated workloads.
- 835ab11: Add a policy-bound documentation skill pilot that runs only in isolated diff-only or shadow mode and returns validated proposals without publishing changes.
- eebfa56: Add structured provider input requests, schema-validated durable resume, explicit session lifecycle operations, and single-sync batching for non-critical run telemetry.
- eee6769: Add opt-in execution-backend, disposable workspace, and expiring credential
  lease contracts with a constrained local implementation that enforces command
  and environment allowlists, time and output limits, cleanup, and fail-closed
  isolation requirements without expanding the starter configuration.
- d599da8: Add durable worker leases with monotonic fencing epochs, fenced checkpoints and
  heartbeats, safe external-action reconciliation, idempotent inbox/outbox
  helpers, and atomic domain-event plus outbox batches.
- 8826660: Add the versioned HTTP artifact-store contract, tested runtime adapter, protocol
  documentation, and grader entrypoint
- Updated dependencies [0aef42f]
- Updated dependencies [e9c43a7]
- Updated dependencies [98a9a9b]
- Updated dependencies [e36d267]
- Updated dependencies [eebfa56]
- Updated dependencies [eebfa56]
- Updated dependencies [1933233]
- Updated dependencies [eebfa56]
- Updated dependencies [eebfa56]
- Updated dependencies [eebfa56]
- Updated dependencies [d599da8]
- Updated dependencies [8826660]
  - @fdekit/core@0.5.5

## 0.5.4

### Patch Changes

- Updated dependencies [2d37d1f]
  - @fdekit/core@0.5.4

## 0.5.3

### Patch Changes

- d486e1b: Harden the human review loop end to end, fixing every issue from the 0.5.2 field report.

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
  - Waiting on an approval no longer counts as a policy violation, so `noPolicyViolation()` works under gating; new `approvalRequested(toolName?)` assertion lets evals assert _for_ gating.
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

- Updated dependencies [d486e1b]
  - @fdekit/core@0.5.3

## 0.5.2

### Patch Changes

- 0757ffc: Add the pull request review flow to the codebase-agent recipe: grounded findings, deterministic anti-hallucination gates, an inline grader, and a human approval boundary.

  - **Review findings contract** (`@fdekit/core`): `ReviewFinding`/`ReviewArtifact` types and `parseFindings` - evidence is required, malformed rows are dropped with field-named reasons (`formatDroppedFindings`) that can be traced and fed back to the model. New eval assertions `expectedFinding` and `expectInjectionResistance`.
  - **Grader** (`@fdekit/runtime`): `defineGrader` + `runGrader` - deterministic location verification against the working tree (path quirks repaired, fabricated locations rejected), then an LLM-judge pass that scores each finding for grounding and suppresses noise, fail-closed. Review artifacts persist to `artifacts/reviews/`.
  - **Connector tools**: `codebase.diff` and `codebase.rankDiff` (churn x import fan-in risk ranking); `github.pr.diff`, `github.review.post` (approve is structurally impossible - humans approve), `github.pr.reply`; `linear.issue.get`/`linear.issue.comment` and `jira.issue.get`/`jira.issue.comment` for linked-ticket intent checks; `slack.notify` reviewer cards.
  - **codebase-agent recipe**: one agent, two flows (findings + PR review) selected by input; `reviewMode` ladder `shadow` (default) → `advisory` → `request-changes`; graded review runner `recipes/codebase-agent/review.mjs`; three eval suites including injection resistance, all passing offline with the mock provider.
  - Fixes the recipe's TODO eval dataset for the 0.5.0 regex search change (`TODO\(fdekit\)`).

- Updated dependencies [0757ffc]
  - @fdekit/core@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [a5f7a9d]
  - @fdekit/core@0.5.1

## 0.5.0

### Patch Changes

- @fdekit/core@0.5.0

## 0.4.7

### Patch Changes

- ad31181: console report modifications, command and runtime-related small changes
- Updated dependencies [ad31181]
  - @fdekit/core@0.4.7

## 0.4.6

### Patch Changes

- @fdekit/core@0.4.6

## 0.4.5

### Patch Changes

- f1919a1: take connectors variables from .env, search by substring on codebase.search, use the correct labels for jira and linear
- Updated dependencies [f1919a1]
  - @fdekit/core@0.4.5

## 0.4.4

### Patch Changes

- d1d9280: validate connectors, polish commands, runs and evidence with k6, s3 client validation
- Updated dependencies [d1d9280]
  - @fdekit/core@0.4.4

## 0.4.3

### Patch Changes

- 0f8e226: command surface, s3 store and core governed-loop, validation gaps and DX/docs
- Updated dependencies [0f8e226]
  - @fdekit/core@0.4.3

## 0.4.2

### Patch Changes

- dbe7868: Simplify newly initialized projects around an env-selected provider, a minimal runnable agent config, clearer `.env.example` guidance, and a first-loop npm script. Config discovery and all file-creating workflows now keep deployment files, package/env mutations, recipes, and runtime output inside a contained `fdekit/` project, while preserving legacy root configs and invocation-relative recipe paths. The default runtime output and cache directory is now `artifacts/` instead of `.fdekit/`.
- c77f318: fdekit init scaffolding, simpler starter config
- Updated dependencies [dbe7868]
- Updated dependencies [c77f318]
  - @fdekit/core@0.4.2

## 0.4.1

### Patch Changes

- 558a126: patches for connectors, providers and environments: error handling, idempotency for tools and connectors, environments examples, tool error handling for providers
- Updated dependencies [558a126]
  - @fdekit/core@0.4.1

## 0.4.0

### Minor Changes

- 1e4afcc: command line fixes, improvements

### Patch Changes

- @fdekit/core@0.4.0

## 0.3.0

### Minor Changes

- 0cb6f4a: Add environment endpoint references: `environmentEndpoint('customer-api')` lets connectors resolve their base URL from the runtime environment's exported endpoints at tool-call time (via the new `ToolCallContext.runtimeEnvironment`), making the environment the single source of truth for customer API wiring. `fdekit validate` errors when a referenced endpoint is not exported. The support-triage scaffold drops its manual `CUSTOMER_API_URL` wiring and relies on the connector's call-time env resolution.
- 0cb6f4a: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.

### Patch Changes

- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
  - @fdekit/core@0.3.0

## 0.2.0

### Minor Changes

- 16dc2da: Add environment endpoint references: `environmentEndpoint('customer-api')` lets connectors resolve their base URL from the runtime environment's exported endpoints at tool-call time (via the new `ToolCallContext.runtimeEnvironment`), making the environment the single source of truth for customer API wiring. `fdekit validate` errors when a referenced endpoint is not exported. The support-triage scaffold drops its manual `CUSTOMER_API_URL` wiring and relies on the connector's call-time env resolution.
- 16dc2da: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.

### Patch Changes

- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
  - @fdekit/core@0.2.0
