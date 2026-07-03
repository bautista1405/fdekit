# @fdekit/connector-codebase

## Purpose

`@fdekit/connector-codebase` lets an FDEKit agent list, search, and read files under one local codebase root, and navigate TypeScript/JavaScript code by symbol: declarations, usages, per-file import graphs, and budgeted context bundles. It is intended for code review, codebase analysis, and recipe flows that need repository context without giving the agent broad filesystem access.

## Who should use this package

- Deployment authors who need local codebase context in an agent run.
- Recipe authors building engineering or code-review workflows.
- Connector contributors maintaining safe path resolution and read limits.

Choose `@fdekit/core` when writing your own connector contract. Choose `@fdekit/runtime` when executing the agent loop that calls this connector.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { codebaseConnector } from '@fdekit/connector-codebase';

const codebase = codebaseConnector({
  rootDir: process.env.CODEBASE_ROOT ?? '.',
});

export default defineDeployment({
  name: 'codebase-review',
  environment: 'local',
  connectors: { codebase },
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    // ...
  },
});
```

Tools exposed to agents:

| Tool | What it does |
| --- | --- |
| `codebase.listFiles` | List files under the configured root |
| `codebase.search` | Regex search (ripgrep syntax, case-sensitive) |
| `codebase.readFile` | Read a file, optionally by line range |
| `codebase.symbols` | List indexed declarations filtered by name, file, or kind |
| `codebase.usages` | Find references of a symbol, separated from its declaration sites |
| `codebase.deps` | Import graph for one file: `imports` and `importedBy` |
| `codebase.context` | Definition bodies under a byte budget plus usage previews |

## Symbol navigation

The navigation tools are standard: they ship with the connector, backed by a
tree-sitter symbol index (`web-tree-sitter` + `tree-sitter-wasms`) and ripgrep
(`@vscode/ripgrep`), all installed as regular dependencies. No extra install
steps are required.

- The tree-sitter runtime loads lazily on the first navigation tool call, so
  commands that never navigate pay no startup cost.
- If the ripgrep binary is unavailable (for example installs that run with
  `--ignore-scripts`, which skip its binary download), `codebase.search` and
  `codebase.usages` fall back to a built-in JS scanner with the same result
  shape, slower on large repositories.
- Symbol indexing covers TypeScript and JavaScript (`.ts`, `.tsx`, `.js`,
  `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`) in this release.
- The index is cached in memory per process and, when the connector runs inside
  an FDEKit project (`FDEKIT_PROJECT_DIR`), persisted to the project's
  `artifacts/cache/` keyed by codebase root. The connector never writes into
  the analyzed repository.
- `importedBy` resolves relative import specifiers only; package imports and
  tsconfig path aliases are reported in `imports` but not followed.
- `fdekit doctor` reports navigation readiness for this connector: whether the
  tree-sitter parser and grammars load, whether the ripgrep binary is present
  (or search is on the JS fallback), and the symbol-index cache status.

## Public API surface

Import from the package root:

```ts
import { codebaseConnector } from '@fdekit/connector-codebase';
import type { CodebaseConnectorOptions, CodebaseSearchMatch } from '@fdekit/connector-codebase';
```

Root exports include `codebaseConnector`, `CodebaseConnectorConfig`, `CodebaseConnectorOptions`, `CodebaseFileEntry`, `CodebaseListFilesArgs`, `CodebaseSearchArgs`, `CodebaseSearchMatch`, `CodebaseReadFileArgs`, `CodebaseReadFileResult`, `CodebaseSymbolKind`, `CodebaseSymbolEntry`, `CodebaseSymbolsArgs`, `CodebaseSymbolsResult`, `CodebaseUsagesArgs`, `CodebaseUsagesResult`, `CodebaseDepsArgs`, `CodebaseDepsResult`, `CodebaseContextArgs`, `CodebaseContextDefinition`, and `CodebaseContextResult`. The connector family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#connectors).

## Stability/backward-compat notes

`@fdekit/connector-codebase` is public but pre-1.0. The package-root factory, option/result types, tool names, and default root-escape protections are compatibility-sensitive.

Since 0.5.0, `codebase.search` matches regular expressions (ripgrep syntax, case-sensitive) instead of case-insensitive literal substrings; escape special characters to match literal text (for example `TODO\(fdekit\)`).

Subpath imports are internal. The connector should continue to block reads that escape the configured root directory.

## See also

- Connector authoring contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- Connector family: [customer API](../customer-api/README.md), [GitHub](../github/README.md), [Slack](../slack/README.md), [Jira](../jira/README.md), [Linear](../linear/README.md), [Postgres](../postgres/README.md), [k6](../k6/README.md), [HubSpot](../hubspot/README.md), [Salesforce](../salesforce/README.md)
- Connector cookbook: [Connector Cookbook](../../../docs/cookbook/connectors.md)
