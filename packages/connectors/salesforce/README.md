# @fdekit/connector-salesforce

## Purpose

`@fdekit/connector-salesforce` lets FDEKit agents create Salesforce activity records through both `salesforce.task.create` and the common `crm.note.create` capability. Local mode returns deterministic Salesforce activity records; API mode creates Salesforce `Task` records through the REST API.

## Who should use this package

- Deployment authors who want CRM activity creation in Salesforce.
- Recipe authors using the common `crm.note.create` capability across HubSpot and Salesforce.
- Connector contributors maintaining Salesforce API behavior and local-mode parity.

Choose HubSpot when the customer CRM is HubSpot. Choose a custom connector for another CRM.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { salesforceConnector } from '@fdekit/connector-salesforce';

const salesforce = salesforceConnector({
  mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local',
  instanceUrl: process.env.SALESFORCE_INSTANCE_URL,
  accessTokenEnv: 'SALESFORCE_ACCESS_TOKEN',
});

export default defineDeployment({
  name: 'salesforce-sales-research',
  environment: 'local',
  connectors: { salesforce },
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    // ...
  },
});
```

Set `SALESFORCE_INSTANCE_URL` and `SALESFORCE_ACCESS_TOKEN` for API mode.

## Public API surface

Import from the package root:

```ts
import { salesforceConnector } from '@fdekit/connector-salesforce';
import type { SalesforceConnectorOptions, CreateSalesforceTaskResult } from '@fdekit/connector-salesforce';
```

Root exports include `salesforceConnector`, `SalesforceConnectorConfig`, `SalesforceConnectorMode`, `SalesforceConnectorOptions`, `CreateSalesforceTaskArgs`, and `CreateSalesforceTaskResult`. The connector family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#connectors).

## Stability/backward-compat notes

`@fdekit/connector-salesforce` is public but pre-1.0. The package-root factory, option/result types, local/API modes, `salesforce.task.create`, and `crm.note.create` tool names are compatibility-sensitive.

Subpath imports are internal. Keep local mode deterministic so demos and tests do not require Salesforce credentials.

## See also

- Connector authoring contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- CRM connector neighbor: [HubSpot](../hubspot/README.md)
- Connector family: [customer API](../customer-api/README.md), [codebase](../codebase/README.md), [GitHub](../github/README.md), [Slack](../slack/README.md), [Jira](../jira/README.md), [Linear](../linear/README.md), [Postgres](../postgres/README.md), [k6](../k6/README.md)
