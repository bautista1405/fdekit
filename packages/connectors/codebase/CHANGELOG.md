# @fdekit/connector-codebase

## 0.6.1

### Patch Changes

- @fdekit/core@0.6.1

## 0.6.0

### Minor Changes

- Align every published @fdekit package on a single version. `@fdekit/catalog` supplies the version that `fdekit init` and `fdekit recipe install` pin scaffolded projects to, and it had drifted ahead to 0.6.0 while the runtime packages stayed on 0.5.6. Scaffolds pinned a version that was never published, so `npm install` failed with `ETARGET` in every new project. The catalog now sits in the changesets fixed group and versions with everything else.

## 0.5.6

### Patch Changes

- @fdekit/core@0.5.6

## 0.5.5

### Patch Changes

- e9c43a7: Add immutable-base multi-file repository change-set contracts and a typed local
  Git implementation with permitted paths, expected blob IDs, shadow validation,
  validator evidence, atomic expected-old-ref publication, stale detection, and
  protected fallback signaling.
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

- a5f7a9d: Add connector readiness checks to `fdekit doctor`.

  - New optional `readiness()` capability on the connector contract (`ConnectorDefinition` in `@fdekit/core`), surfaced as a "Connector Readiness" section in `fdekit doctor` and counted toward its exit code. It is operator-facing diagnostics, distinct from agent-invocable `*.healthCheck` tools.
  - The codebase connector implements it: verifies the tree-sitter parser and TypeScript/JavaScript grammars load, reports whether the ripgrep binary is present (or that `codebase.search`/`codebase.usages` fall back to the built-in JavaScript scanner), and reports symbol-index cache status.

- Updated dependencies [a5f7a9d]
  - @fdekit/core@0.5.1

## 0.5.0

### Minor Changes

- b964d31: Add TS/JS symbol navigation tools to the codebase connector and upgrade `codebase.search` to regular expressions.

  - New read-only tools: `codebase.symbols` (indexed declarations filtered by name/file/kind), `codebase.usages` (references separated from declaration sites), `codebase.deps` (per-file import graph with `imports`/`importedBy`), and `codebase.context` (definition bodies under a byte budget plus usage previews).
  - **Behavior change:** `codebase.search` now matches regular expressions (ripgrep syntax, case-sensitive) instead of case-insensitive literal substrings. Escape special characters to match literal text, e.g. `TODO\(fdekit\)`.
  - Navigation is standard: `web-tree-sitter`, `tree-sitter-wasms`, and `@vscode/ripgrep` are regular dependencies of the connector, so every agent gets the full toolset with no extra install steps. The tree-sitter runtime loads lazily on first use; if the ripgrep binary is unavailable (installs with `--ignore-scripts`), search falls back to a built-in JS scanner.
  - The symbol index is cached under the FDEKit project's `artifacts/cache/` keyed by codebase root; the connector never writes into the analyzed repository.
  - Language support for symbol indexing in this release: TypeScript and JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`).

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

### Patch Changes

- @fdekit/core@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
  - @fdekit/core@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
  - @fdekit/core@0.2.0
