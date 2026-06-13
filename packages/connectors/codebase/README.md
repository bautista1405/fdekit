# @fdekit/connector-codebase

## Purpose

`@fdekit/connector-codebase` lets an FDEKit agent list, search, and read files under one local codebase root. It is intended for code review, codebase analysis, and recipe flows that need repository context without giving the agent broad filesystem access.

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

Tools exposed to agents: `codebase.listFiles`, `codebase.search`, and `codebase.readFile`.

## Public API surface

Import from the package root:

```ts
import { codebaseConnector } from '@fdekit/connector-codebase';
import type { CodebaseConnectorOptions, CodebaseSearchMatch } from '@fdekit/connector-codebase';
```

Root exports include `codebaseConnector`, `CodebaseConnectorConfig`, `CodebaseConnectorOptions`, `CodebaseFileEntry`, `CodebaseListFilesArgs`, `CodebaseSearchArgs`, `CodebaseSearchMatch`, `CodebaseReadFileArgs`, and `CodebaseReadFileResult`. The connector family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#connectors).

## Stability/backward-compat notes

`@fdekit/connector-codebase` is public but pre-1.0. The package-root factory, option/result types, tool names, and default root-escape protections are compatibility-sensitive.

Subpath imports are internal. The connector should continue to block reads that escape the configured root directory.

## See also

- Connector authoring contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- Connector family: [customer API](../customer-api/README.md), [GitHub](../github/README.md), [Slack](../slack/README.md), [Jira](../jira/README.md), [Linear](../linear/README.md), [Postgres](../postgres/README.md), [k6](../k6/README.md), [HubSpot](../hubspot/README.md), [Salesforce](../salesforce/README.md)
- Connector cookbook: [Connector Cookbook](../../../docs/cookbook/connectors.md)
