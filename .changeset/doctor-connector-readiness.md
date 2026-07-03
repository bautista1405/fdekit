---
"@fdekit/cli": patch
"@fdekit/connector-codebase": patch
"@fdekit/core": patch
---

Add connector readiness checks to `fdekit doctor`.

- New optional `readiness()` capability on the connector contract (`ConnectorDefinition` in `@fdekit/core`), surfaced as a "Connector Readiness" section in `fdekit doctor` and counted toward its exit code. It is operator-facing diagnostics, distinct from agent-invocable `*.healthCheck` tools.
- The codebase connector implements it: verifies the tree-sitter parser and TypeScript/JavaScript grammars load, reports whether the ripgrep binary is present (or that `codebase.search`/`codebase.usages` fall back to the built-in JavaScript scanner), and reports symbol-index cache status.
