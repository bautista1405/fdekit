# @fdekit/connector-hubspot

## Purpose

`@fdekit/connector-hubspot` lets FDEKit agents create CRM notes through both `hubspot.note.create` and the common `crm.note.create` capability. Local mode returns deterministic CRM notes; API mode calls HubSpot CRM notes through a private app token.

## Who should use this package

- Deployment authors who want CRM note creation in HubSpot.
- Recipe authors using the common `crm.note.create` capability across HubSpot and Salesforce.
- Connector contributors maintaining HubSpot API behavior and local-mode parity.

Choose Salesforce when the customer CRM is Salesforce. Choose a custom connector for another CRM.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { hubspotConnector } from '@fdekit/connector-hubspot';

const hubspot = hubspotConnector({
  mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local',
  accessTokenEnv: 'HUBSPOT_ACCESS_TOKEN',
});

export default defineDeployment({
  name: 'hubspot-sales-research',
  environment: 'local',
  connectors: { hubspot },
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    // ...
  },
});
```

Set `HUBSPOT_ACCESS_TOKEN` for API mode.

## Public API surface

Import from the package root:

```ts
import { hubspotConnector } from '@fdekit/connector-hubspot';
import type { HubSpotConnectorOptions, CreateHubSpotNoteResult } from '@fdekit/connector-hubspot';
```

Root exports include `hubspotConnector`, `HubSpotConnectorConfig`, `HubSpotConnectorMode`, `HubSpotConnectorOptions`, `HubSpotAssociation`, `HubSpotAssociationType`, `CreateHubSpotNoteArgs`, and `CreateHubSpotNoteResult`. The connector family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#connectors).

## Stability/backward-compat notes

`@fdekit/connector-hubspot` is public but pre-1.0. The package-root factory, option/result types, local/API modes, `hubspot.note.create`, and `crm.note.create` tool names are compatibility-sensitive.

Subpath imports are internal. Keep local mode deterministic so demos and tests do not require HubSpot credentials.

## See also

- Connector authoring contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- CRM connector neighbor: [Salesforce](../salesforce/README.md)
- Connector family: [customer API](../customer-api/README.md), [codebase](../codebase/README.md), [GitHub](../github/README.md), [Slack](../slack/README.md), [Jira](../jira/README.md), [Linear](../linear/README.md), [Postgres](../postgres/README.md), [k6](../k6/README.md)
