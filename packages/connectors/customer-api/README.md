# @fdekit/connector-customer-api

## Purpose

`@fdekit/connector-customer-api` gives support-triage-style agents a customer and ticket API surface. It works against the bundled demo API by default and can be pointed at customer-owned APIs with route and response mappers.

## Who should use this package

- Deployment authors wiring customer support systems into an FDEKit recipe.
- Recipe authors who need stable `customer.get`, `ticket.get`, and `ticket.escalate` tools.
- Connector contributors adapting the demo connector to real customer API shapes.

Choose a custom `defineConnector()` implementation when the customer API is too different from customer/ticket/escalation semantics.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { customerApiConnector } from '@fdekit/connector-customer-api';

const customerApi = customerApiConnector({
  baseUrl: process.env.CUSTOMER_API_URL ?? 'http://127.0.0.1:8787',
  headers: {
    authorization: `Bearer ${process.env.CUSTOMER_API_TOKEN}`,
  },
});

export default defineDeployment({
  name: 'support-triage',
  environment: 'local',
  connectors: { customerApi },
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    // ...
  },
});
```

Tools exposed to agents: `customer.get`, `ticket.get`, and `ticket.escalate`.

## Public API surface

Import from the package root:

```ts
import { customerApiConnector } from '@fdekit/connector-customer-api';
import type { CustomerApiConnectorOptions, CustomerApiRoutes } from '@fdekit/connector-customer-api';
```

Root exports include `customerApiConnector`, `CustomerApiConnectorConfig`, `CustomerApiConnectorOptions`, `CustomerApiMapper`, `CustomerApiRoutes`, `GetCustomerArgs`, `GetTicketArgs`, and `EscalateTicketArgs`. The connector family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#connectors).

## Stability/backward-compat notes

`@fdekit/connector-customer-api` is public but pre-1.0. The package-root factory, option types, mapper contracts, route hooks, and tool names are compatibility-sensitive.

Subpath imports are internal. Keep customer-specific authentication, routes, and mappers in options rather than adding global runtime assumptions.

## See also

- Connector authoring contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- Local environment packages: [Docker](../../environments/docker/README.md), [Floci](../../environments/floci/README.md)
- Connector family: [codebase](../codebase/README.md), [GitHub](../github/README.md), [Slack](../slack/README.md), [Jira](../jira/README.md), [Linear](../linear/README.md), [Postgres](../postgres/README.md), [k6](../k6/README.md), [HubSpot](../hubspot/README.md), [Salesforce](../salesforce/README.md)
- Connector cookbook: [Connector Cookbook](../../../docs/cookbook/connectors.md)
