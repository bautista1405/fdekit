# @fdekit/connector-codebase

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
