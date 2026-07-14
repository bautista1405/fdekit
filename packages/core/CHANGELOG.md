# @fdekit/core

## 0.5.2

### Patch Changes

- 0757ffc: Add the pull request review flow to the codebase-agent recipe: grounded findings, deterministic anti-hallucination gates, an inline grader, and a human approval boundary.

  - **Review findings contract** (`@fdekit/core`): `ReviewFinding`/`ReviewArtifact` types and `parseFindings` - evidence is required, malformed rows are dropped with field-named reasons (`formatDroppedFindings`) that can be traced and fed back to the model. New eval assertions `expectedFinding` and `expectInjectionResistance`.
  - **Grader** (`@fdekit/runtime`): `defineGrader` + `runGrader` - deterministic location verification against the working tree (path quirks repaired, fabricated locations rejected), then an LLM-judge pass that scores each finding for grounding and suppresses noise, fail-closed. Review artifacts persist to `artifacts/reviews/`.
  - **Connector tools**: `codebase.diff` and `codebase.rankDiff` (churn x import fan-in risk ranking); `github.pr.diff`, `github.review.post` (approve is structurally impossible - humans approve), `github.pr.reply`; `linear.issue.get`/`linear.issue.comment` and `jira.issue.get`/`jira.issue.comment` for linked-ticket intent checks; `slack.notify` reviewer cards.
  - **codebase-agent recipe**: one agent, two flows (findings + PR review) selected by input; `reviewMode` ladder `shadow` (default) → `advisory` → `request-changes`; graded review runner `recipes/codebase-agent/review.mjs`; three eval suites including injection resistance, all passing offline with the mock provider.
  - Fixes the recipe's TODO eval dataset for the 0.5.0 regex search change (`TODO\(fdekit\)`).

## 0.5.1

### Patch Changes

- a5f7a9d: Add connector readiness checks to `fdekit doctor`.

  - New optional `readiness()` capability on the connector contract (`ConnectorDefinition` in `@fdekit/core`), surfaced as a "Connector Readiness" section in `fdekit doctor` and counted toward its exit code. It is operator-facing diagnostics, distinct from agent-invocable `*.healthCheck` tools.
  - The codebase connector implements it: verifies the tree-sitter parser and TypeScript/JavaScript grammars load, reports whether the ripgrep binary is present (or that `codebase.search`/`codebase.usages` fall back to the built-in JavaScript scanner), and reports symbol-index cache status.

## 0.5.0

## 0.4.7

### Patch Changes

- ad31181: console report modifications, command and runtime-related small changes

## 0.4.6

## 0.4.5

### Patch Changes

- f1919a1: take connectors variables from .env, search by substring on codebase.search, use the correct labels for jira and linear

## 0.4.4

### Patch Changes

- d1d9280: validate connectors, polish commands, runs and evidence with k6, s3 client validation

## 0.4.3

### Patch Changes

- 0f8e226: command surface, s3 store and core governed-loop, validation gaps and DX/docs

## 0.4.2

### Patch Changes

- dbe7868: Simplify newly initialized projects around an env-selected provider, a minimal runnable agent config, clearer `.env.example` guidance, and a first-loop npm script. Config discovery and all file-creating workflows now keep deployment files, package/env mutations, recipes, and runtime output inside a contained `fdekit/` project, while preserving legacy root configs and invocation-relative recipe paths. The default runtime output and cache directory is now `artifacts/` instead of `.fdekit/`.
- c77f318: fdekit init scaffolding, simpler starter config

## 0.4.1

### Patch Changes

- 558a126: patches for connectors, providers and environments: error handling, idempotency for tools and connectors, environments examples, tool error handling for providers

## 0.4.0

## 0.3.0

### Minor Changes

- 0cb6f4a: Add environment endpoint references: `environmentEndpoint('customer-api')` lets connectors resolve their base URL from the runtime environment's exported endpoints at tool-call time (via the new `ToolCallContext.runtimeEnvironment`), making the environment the single source of truth for customer API wiring. `fdekit validate` errors when a referenced endpoint is not exported. The support-triage scaffold drops its manual `CUSTOMER_API_URL` wiring and relies on the connector's call-time env resolution.
- 0cb6f4a: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.
- 0cb6f4a: Honor server `Retry-After` hints in `createHttpReq` (capped by the new `RetryPolicy.maxRetryAfterMs`, default 30s), accept injected official SDK clients in the OpenAI, Anthropic, and Google providers (`client` option, postgres-style optional peer dependencies), and bump default models to the current flagships (`claude-opus-4-8`, `gpt-5.5`, `gemini-3.5-flash`).

## 0.2.0

### Minor Changes

- 16dc2da: Add environment endpoint references: `environmentEndpoint('customer-api')` lets connectors resolve their base URL from the runtime environment's exported endpoints at tool-call time (via the new `ToolCallContext.runtimeEnvironment`), making the environment the single source of truth for customer API wiring. `fdekit validate` errors when a referenced endpoint is not exported. The support-triage scaffold drops its manual `CUSTOMER_API_URL` wiring and relies on the connector's call-time env resolution.
- 16dc2da: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.
- 16dc2da: Honor server `Retry-After` hints in `createHttpReq` (capped by the new `RetryPolicy.maxRetryAfterMs`, default 30s), accept injected official SDK clients in the OpenAI, Anthropic, and Google providers (`client` option, postgres-style optional peer dependencies), and bump default models to the current flagships (`claude-opus-4-8`, `gpt-5.5`, `gemini-3.5-flash`).
