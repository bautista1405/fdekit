# @fdekit/connector-postgres

## Purpose

`@fdekit/connector-postgres` gives FDEKit agents a governance-first Postgres surface for health checks, schema discovery, table description, and governed SQL queries. The default posture is intentionally narrow so a real customer database is not exposed as a free-form SQL shell.

## Who should use this package

- Deployment authors connecting agents to Postgres-backed customer data.
- Recipe authors who need database evidence or read-only query capability.
- Connector contributors maintaining SQL validation, table governance, redaction, and adapter behavior.

Choose a customer-owned app API connector when the agent should not query the database directly.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { postgresConnector } from '@fdekit/connector-postgres';

const postgres = postgresConnector({
  allowedStatements: ['select', 'with'],
  allowedTables: ['customers', 'tickets'],
  deniedTables: ['users', 'audit_logs', 'secrets'],
  schemas: ['public'],
  maxRows: 50,
  queryTimeoutMs: 5000,
});

export default defineDeployment({
  name: 'postgres-support-context',
  environment: 'local',
  connectors: { postgres },
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    // ...
  },
});
```

Tools exposed to agents: `postgres.healthCheck`, `postgres.listTables`, `postgres.describeTable`, and `postgres.query`.

## Public API surface

Import from the package root:

```ts
import { postgresConnector } from '@fdekit/connector-postgres';
import type { PostgresConnectorOptions, PostgresQueryResult } from '@fdekit/connector-postgres';
```

Root exports include `postgresConnector`, `PostgresConnectorConfig`, `PostgresConnectorMode`, `PostgresConnectorOptions`, `PostgresQueryArgs`, `PostgresQueryResult`, `PostgresQueryClient`, `PostgresPoolOptions`, schema discovery arg/result types, and `SqlStatementKind`. The connector family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#connectors).

## Stability/backward-compat notes

`@fdekit/connector-postgres` is public but pre-1.0. The package-root factory, option/result types, tool names, default read-only posture, redaction defaults, and SQL governance behavior are compatibility-sensitive.

Subpath imports are internal. Broader SQL support should remain explicit through options.

## See also

- Connector authoring contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- Data-adjacent connectors: [customer API](../customer-api/README.md), [codebase](../codebase/README.md)
- Connector family: [GitHub](../github/README.md), [Slack](../slack/README.md), [Jira](../jira/README.md), [Linear](../linear/README.md), [k6](../k6/README.md), [HubSpot](../hubspot/README.md), [Salesforce](../salesforce/README.md)
