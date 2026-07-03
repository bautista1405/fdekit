---
"@fdekit/connector-codebase": minor
---

Add TS/JS symbol navigation tools to the codebase connector and upgrade `codebase.search` to regular expressions.

- New read-only tools: `codebase.symbols` (indexed declarations filtered by name/file/kind), `codebase.usages` (references separated from declaration sites), `codebase.deps` (per-file import graph with `imports`/`importedBy`), and `codebase.context` (definition bodies under a byte budget plus usage previews).
- **Behavior change:** `codebase.search` now matches regular expressions (ripgrep syntax, case-sensitive) instead of case-insensitive literal substrings. Escape special characters to match literal text, e.g. `TODO\(fdekit\)`.
- Navigation is standard: `web-tree-sitter`, `tree-sitter-wasms`, and `@vscode/ripgrep` are regular dependencies of the connector, so every agent gets the full toolset with no extra install steps. The tree-sitter runtime loads lazily on first use; if the ripgrep binary is unavailable (installs with `--ignore-scripts`), search falls back to a built-in JS scanner.
- The symbol index is cached under the FDEKit project's `artifacts/cache/` keyed by codebase root; the connector never writes into the analyzed repository.
- Language support for symbol indexing in this release: TypeScript and JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`).
