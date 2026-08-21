# fdekit

## 0.6.0

### Minor Changes

- Align every published @fdekit package on a single version. `@fdekit/catalog` supplies the version that `fdekit init` and `fdekit recipe install` pin scaffolded projects to, and it had drifted ahead to 0.6.0 while the runtime packages stayed on 0.5.6. Scaffolds pinned a version that was never published, so `npm install` failed with `ETARGET` in every new project. The catalog now sits in the changesets fixed group and versions with everything else.

## 0.5.6

### Patch Changes

- fa9b821: Scope approval decisions to one exact run, and keep the credential-free CLI demos aligned with durable approval and resume behavior.
- Updated dependencies [fa9b821]
  - @fdekit/runtime@0.5.6
  - @fdekit/console@0.5.6
  - @fdekit/core@0.5.6
  - @fdekit/provider-anthropic@0.5.6
  - @fdekit/provider-google@0.5.6
  - @fdekit/provider-ollama@0.5.6
  - @fdekit/provider-openai@0.5.6

## 0.5.5

### Patch Changes

- 0aef42f: Add a correct-before-approve flow that validates replacement tool arguments,
  supersedes the pending request, issues a fresh exact approval fingerprint, and
  resumes only against the corrected request.
- c1bb2cd: Add exact governed tool sequences with policy, approval, audit, trace, durable
  multi-approval resume, and no provider re-planning; migrate the graded codebase
  review delivery path away from direct connector handler calls.
- 6d5cc4b: Extract shared provider, connector, and recipe manifests into @fdekit/catalog
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
- Updated dependencies [6d5cc4b]
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
  - @fdekit/console@0.5.5
  - @fdekit/catalog@0.6.0
  - @fdekit/provider-openai@0.5.5
  - @fdekit/provider-anthropic@0.5.5
  - @fdekit/provider-google@0.5.5
  - @fdekit/provider-ollama@0.5.5

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
  - @fdekit/console@0.5.4
  - @fdekit/provider-anthropic@0.5.4
  - @fdekit/provider-google@0.5.4
  - @fdekit/provider-ollama@0.5.4
  - @fdekit/provider-openai@0.5.4
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
  - @fdekit/console@0.5.3
  - @fdekit/provider-anthropic@0.5.3
  - @fdekit/provider-google@0.5.3
  - @fdekit/provider-ollama@0.5.3
  - @fdekit/provider-openai@0.5.3

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
  - @fdekit/runtime@0.5.2
  - @fdekit/console@0.5.2
  - @fdekit/provider-anthropic@0.5.2
  - @fdekit/provider-google@0.5.2
  - @fdekit/provider-ollama@0.5.2
  - @fdekit/provider-openai@0.5.2

## 0.5.1

### Patch Changes

- a5f7a9d: Add connector readiness checks to `fdekit doctor`.

  - New optional `readiness()` capability on the connector contract (`ConnectorDefinition` in `@fdekit/core`), surfaced as a "Connector Readiness" section in `fdekit doctor` and counted toward its exit code. It is operator-facing diagnostics, distinct from agent-invocable `*.healthCheck` tools.
  - The codebase connector implements it: verifies the tree-sitter parser and TypeScript/JavaScript grammars load, reports whether the ripgrep binary is present (or that `codebase.search`/`codebase.usages` fall back to the built-in JavaScript scanner), and reports symbol-index cache status.

- Updated dependencies [a5f7a9d]
  - @fdekit/core@0.5.1
  - @fdekit/console@0.5.1
  - @fdekit/provider-anthropic@0.5.1
  - @fdekit/provider-google@0.5.1
  - @fdekit/provider-ollama@0.5.1
  - @fdekit/provider-openai@0.5.1
  - @fdekit/runtime@0.5.1

## 0.5.0

### Patch Changes

- @fdekit/core@0.5.0
- @fdekit/runtime@0.5.0
- @fdekit/console@0.5.0
- @fdekit/provider-anthropic@0.5.0
- @fdekit/provider-google@0.5.0
- @fdekit/provider-ollama@0.5.0
- @fdekit/provider-openai@0.5.0

## 0.4.7

### Patch Changes

- ad31181: console report modifications, command and runtime-related small changes
- Updated dependencies [ad31181]
  - @fdekit/console@0.4.7
  - @fdekit/core@0.4.7
  - @fdekit/provider-anthropic@0.4.7
  - @fdekit/provider-google@0.4.7
  - @fdekit/provider-ollama@0.4.7
  - @fdekit/provider-openai@0.4.7
  - @fdekit/runtime@0.4.7

## 0.4.6

### Patch Changes

- Updated dependencies [e523d60]
  - @fdekit/console@0.4.6
  - @fdekit/core@0.4.6
  - @fdekit/runtime@0.4.6
  - @fdekit/provider-anthropic@0.4.6
  - @fdekit/provider-google@0.4.6
  - @fdekit/provider-ollama@0.4.6
  - @fdekit/provider-openai@0.4.6

## 0.4.5

### Patch Changes

- f1919a1: take connectors variables from .env, search by substring on codebase.search, use the correct labels for jira and linear
- Updated dependencies [f1919a1]
  - @fdekit/console@0.4.5
  - @fdekit/core@0.4.5
  - @fdekit/provider-anthropic@0.4.5
  - @fdekit/provider-google@0.4.5
  - @fdekit/provider-ollama@0.4.5
  - @fdekit/provider-openai@0.4.5
  - @fdekit/runtime@0.4.5

## 0.4.4

### Patch Changes

- d1d9280: validate connectors, polish commands, runs and evidence with k6, s3 client validation
- Updated dependencies [d1d9280]
  - @fdekit/console@0.4.4
  - @fdekit/core@0.4.4
  - @fdekit/provider-anthropic@0.4.4
  - @fdekit/provider-google@0.4.4
  - @fdekit/provider-ollama@0.4.4
  - @fdekit/provider-openai@0.4.4
  - @fdekit/runtime@0.4.4

## 0.4.3

### Patch Changes

- 0f8e226: command surface, s3 store and core governed-loop, validation gaps and DX/docs
- Updated dependencies [0f8e226]
  - @fdekit/console@0.4.3
  - @fdekit/core@0.4.3
  - @fdekit/runtime@0.4.3
  - @fdekit/provider-anthropic@0.4.3
  - @fdekit/provider-google@0.4.3
  - @fdekit/provider-ollama@0.4.3
  - @fdekit/provider-openai@0.4.3

## 0.4.2

### Patch Changes

- dbe7868: Simplify newly initialized projects around an env-selected provider, a minimal runnable agent config, clearer `.env.example` guidance, and a first-loop npm script. Config discovery and all file-creating workflows now keep deployment files, package/env mutations, recipes, and runtime output inside a contained `fdekit/` project, while preserving legacy root configs and invocation-relative recipe paths. The default runtime output and cache directory is now `artifacts/` instead of `.fdekit/`.
- c77f318: fdekit init scaffolding, simpler starter config
- Updated dependencies [dbe7868]
- Updated dependencies [c77f318]
  - @fdekit/core@0.4.2
  - @fdekit/runtime@0.4.2
  - @fdekit/console@0.4.2
  - @fdekit/provider-anthropic@0.4.2
  - @fdekit/provider-google@0.4.2
  - @fdekit/provider-ollama@0.4.2
  - @fdekit/provider-openai@0.4.2

## 0.4.1

### Patch Changes

- 558a126: patches for connectors, providers and environments: error handling, idempotency for tools and connectors, environments examples, tool error handling for providers
- Updated dependencies [558a126]
  - @fdekit/console@0.4.1
  - @fdekit/core@0.4.1
  - @fdekit/provider-anthropic@0.4.1
  - @fdekit/provider-google@0.4.1
  - @fdekit/provider-ollama@0.4.1
  - @fdekit/provider-openai@0.4.1
  - @fdekit/runtime@0.4.1

## 0.4.0

### Minor Changes

- 1e4afcc: command line fixes, improvements

### Patch Changes

- Updated dependencies [1e4afcc]
  - @fdekit/runtime@0.4.0
  - @fdekit/console@0.4.0
  - @fdekit/core@0.4.0
  - @fdekit/provider-anthropic@0.4.0
  - @fdekit/provider-google@0.4.0
  - @fdekit/provider-ollama@0.4.0
  - @fdekit/provider-openai@0.4.0

## 0.3.0

### Minor Changes

- 0cb6f4a: Add environment endpoint references: `environmentEndpoint('customer-api')` lets connectors resolve their base URL from the runtime environment's exported endpoints at tool-call time (via the new `ToolCallContext.runtimeEnvironment`), making the environment the single source of truth for customer API wiring. `fdekit validate` errors when a referenced endpoint is not exported. The support-triage scaffold drops its manual `CUSTOMER_API_URL` wiring and relies on the connector's call-time env resolution.
- 0cb6f4a: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.
- 0cb6f4a: Honor server `Retry-After` hints in `createHttpReq` (capped by the new `RetryPolicy.maxRetryAfterMs`, default 30s), accept injected official SDK clients in the OpenAI, Anthropic, and Google providers (`client` option, postgres-style optional peer dependencies), and bump default models to the current flagships (`claude-opus-4-8`, `gpt-5.5`, `gemini-3.5-flash`).

### Patch Changes

- 0cb6f4a: Derive scaffolded FDEKit dependency versions from the CLI package version and add the Changesets release workflow.
- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
  - @fdekit/core@0.3.0
  - @fdekit/runtime@0.3.0
  - @fdekit/provider-anthropic@0.3.0
  - @fdekit/provider-openai@0.3.0
  - @fdekit/provider-google@0.3.0
  - @fdekit/console@0.3.0
  - @fdekit/provider-ollama@0.3.0

## 0.2.0

### Minor Changes

- 16dc2da: Add environment endpoint references: `environmentEndpoint('customer-api')` lets connectors resolve their base URL from the runtime environment's exported endpoints at tool-call time (via the new `ToolCallContext.runtimeEnvironment`), making the environment the single source of truth for customer API wiring. `fdekit validate` errors when a referenced endpoint is not exported. The support-triage scaffold drops its manual `CUSTOMER_API_URL` wiring and relies on the connector's call-time env resolution.
- 16dc2da: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.
- 16dc2da: Honor server `Retry-After` hints in `createHttpReq` (capped by the new `RetryPolicy.maxRetryAfterMs`, default 30s), accept injected official SDK clients in the OpenAI, Anthropic, and Google providers (`client` option, postgres-style optional peer dependencies), and bump default models to the current flagships (`claude-opus-4-8`, `gpt-5.5`, `gemini-3.5-flash`).

### Patch Changes

- 16dc2da: Derive scaffolded FDEKit dependency versions from the CLI package version and add the Changesets release workflow.
- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
  - @fdekit/core@0.2.0
  - @fdekit/runtime@0.2.0
  - @fdekit/provider-anthropic@0.2.0
  - @fdekit/provider-openai@0.2.0
  - @fdekit/provider-google@0.2.0
  - @fdekit/console@0.2.0
  - @fdekit/provider-ollama@0.2.0
