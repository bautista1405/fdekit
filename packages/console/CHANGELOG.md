# @fdekit/console

## 0.5.6

### Patch Changes

- Updated dependencies [fa9b821]
  - @fdekit/runtime@0.5.6
  - @fdekit/core@0.5.6

## 0.5.5

### Patch Changes

- 0aef42f: Add a correct-before-approve flow that validates replacement tool arguments,
  supersedes the pending request, issues a fresh exact approval fingerprint, and
  resumes only against the corrected request.
- Updated dependencies [0aef42f]
- Updated dependencies [e9c43a7]
- Updated dependencies [98a9a9b]
- Updated dependencies [e36d267]
- Updated dependencies [eebfa56]
- Updated dependencies [b782405]
- Updated dependencies [cc7d8d5]
- Updated dependencies [c1bb2cd]
- Updated dependencies [eebfa56]
- Updated dependencies [b145c5f]
- Updated dependencies [1933233]
- Updated dependencies [eebfa56]
- Updated dependencies [eebfa56]
- Updated dependencies [5e07466]
- Updated dependencies [835ab11]
- Updated dependencies [eebfa56]
- Updated dependencies [eee6769]
- Updated dependencies [d599da8]
- Updated dependencies [8826660]
  - @fdekit/core@0.5.5
  - @fdekit/runtime@0.5.5

## 0.5.4

### Patch Changes

- 2d37d1f: Show reviewed code, not just findings, in the console.

  **Annotated diffs on a new Code Review page.** `fdekit console` now emits
  `reviews.html`, rendering each review artifact with its findings anchored to the
  lines they were raised against. Diffs are prerendered server-side, so the page
  works with JavaScript disabled and stays a single emailable file.

  **Reviews now carry the diff they reviewed.** `ReviewArtifact` gains an optional
  `patchArtifact` pointing at a sibling `<runId>.patch` text artifact. Without it a
  review could not be re-read offline - the console had to refetch the diff from the
  forge to show what was reviewed. Optional, so existing reviews stay valid and
  degrade to a findings-only view.

  **`github.pr.list`** lists open pull requests for the configured repository so a
  review queue can be ranked by risk rather than recency. Read-only (`pulls:read`),
  with no repository argument: the connector is bound to one repo, so the tool
  cannot be aimed elsewhere.

  **Fixed:** a readiness item with no `detail` string threw and took down the entire
  console render. It now degrades instead.

  **New dependency note:** `@fdekit/console` depends on `@pierre/diffs`, which
  declares required peer dependencies on `react` and `react-dom`. npm installs them
  even though no FDEKit code path loads React - only the `ssr` entrypoint is used,
  which renders to an HTML string. Console also declares `@pierre/theme@1.1.0`
  directly because the SSR path imports it through an optional peer whose automatic
  installation differs between npm versions. See the `@fdekit/console` README.

  New public API: `@fdekit/console/diff` (`renderAnnotatedDiff`,
  `prepareConsoleDiffs`), `ConsoleData.reviews`, `ConsoleReview`,
  `renderConsolePages(data, { diffs })`, and review counts on `ConsoleMetrics`.

- Updated dependencies [2d37d1f]
  - @fdekit/core@0.5.4
  - @fdekit/runtime@0.5.4

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
  - @fdekit/runtime@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies [0757ffc]
  - @fdekit/core@0.5.2
  - @fdekit/runtime@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [a5f7a9d]
  - @fdekit/core@0.5.1
  - @fdekit/runtime@0.5.1

## 0.5.0

### Patch Changes

- @fdekit/core@0.5.0
- @fdekit/runtime@0.5.0

## 0.4.7

### Patch Changes

- ad31181: console report modifications, command and runtime-related small changes
- Updated dependencies [ad31181]
  - @fdekit/core@0.4.7
  - @fdekit/runtime@0.4.7

## 0.4.6

### Patch Changes

- e523d60: harness, failed runs, policy enforcement mode, duplication issues, other ui changes
  - @fdekit/core@0.4.6
  - @fdekit/runtime@0.4.6

## 0.4.5

### Patch Changes

- f1919a1: take connectors variables from .env, search by substring on codebase.search, use the correct labels for jira and linear
- Updated dependencies [f1919a1]
  - @fdekit/core@0.4.5
  - @fdekit/runtime@0.4.5

## 0.4.4

### Patch Changes

- d1d9280: validate connectors, polish commands, runs and evidence with k6, s3 client validation
- Updated dependencies [d1d9280]
  - @fdekit/core@0.4.4
  - @fdekit/runtime@0.4.4

## 0.4.3

### Patch Changes

- 0f8e226: command surface, s3 store and core governed-loop, validation gaps and DX/docs
- Updated dependencies [0f8e226]
  - @fdekit/core@0.4.3
  - @fdekit/runtime@0.4.3

## 0.4.2

### Patch Changes

- c77f318: fdekit init scaffolding, simpler starter config
- Updated dependencies [dbe7868]
- Updated dependencies [c77f318]
  - @fdekit/core@0.4.2
  - @fdekit/runtime@0.4.2

## 0.4.1

### Patch Changes

- 558a126: patches for connectors, providers and environments: error handling, idempotency for tools and connectors, environments examples, tool error handling for providers
- Updated dependencies [558a126]
  - @fdekit/core@0.4.1
  - @fdekit/runtime@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [1e4afcc]
  - @fdekit/runtime@0.4.0
  - @fdekit/core@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
  - @fdekit/core@0.3.0
  - @fdekit/runtime@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
  - @fdekit/core@0.2.0
  - @fdekit/runtime@0.2.0
