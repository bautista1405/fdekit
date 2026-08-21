# @fdekit/connector-github

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

- Updated dependencies [0f8e226]
  - @fdekit/core@0.4.3

## 0.4.2

### Patch Changes

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
