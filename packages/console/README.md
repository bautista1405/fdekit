# @fdekit/console

## Purpose

`@fdekit/console` renders the static local dashboard and export bundle for FDEKit traces, evals, macro evals, approvals, audit logs, governance posture, reports, and connector evidence.

Use console when you need dashboard HTML or CSV/Markdown/JSON exports outside the CLI. The CLI uses this package behind `fdekit console`.

## Who should use this package

- CLI contributors working on dashboard output.
- Integrators embedding FDEKit evidence in another local workflow.
- Contributors improving dashboard view models, sections, or export formats.

Choose `@fdekit/runtime` to read/write artifacts and `fdekit` to generate the dashboard from the standard command.

## 5-minute quick example

```ts
import { renderConsolePages, createConsoleExportBundle } from '@fdekit/console';
import type { ConsoleData } from '@fdekit/console';

const data: ConsoleData = {
  deployment,
  traces: [],
  latestEval: null,
  latestMacroEval: null,
  reportMarkdown: null,
  approvals: [],
  auditLog: [],
};

const pages = renderConsolePages(data);
const exports = createConsoleExportBundle(data);

console.log(pages.map((page) => page.fileName), exports.summaryMarkdown);
```

## Public API surface

Import from the package root:

```ts
import { renderConsole, renderConsolePages, createConsoleExportBundle } from '@fdekit/console';
import type { ConsoleData, ConsoleExportBundle, ConsoleHistoryEntry, ConsolePage } from '@fdekit/console';
```

The broader public API index documents the console package boundary and import rule: [Public API Reference](../../docs/api-reference.md#console).

## Stability/backward-compat notes

`@fdekit/console` is public but pre-1.0. The root exports `renderConsole`, `renderConsolePages`, `createConsoleExportBundle`, `ConsoleData`, `ConsoleExportBundle`, `ConsoleHistoryEntry`, and `ConsolePage`.

`renderConsole()` returns the overview page for compatibility. Use `renderConsolePages()` when writing the full static dashboard with `console.html`, `charts.html`, `brief.html`, `readiness.html`, and `workbench.html`.

Subpath imports are internal. Treat HTML structure and CSS classes as implementation details unless they become documented public hooks.

## See also

- Runtime artifacts consumed by the dashboard: [@fdekit/runtime](../runtime/README.md)
- CLI command that writes `artifacts/console.html`: [fdekit](../cli/README.md)
- Deployment config types used in `ConsoleData`: [@fdekit/core](../core/README.md)
- Console command docs: [CLI Reference](../../docs/cli-reference.md#runtime-and-evidence)
