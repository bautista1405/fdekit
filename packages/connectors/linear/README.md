# @fdekit/connector-linear

## Purpose

`@fdekit/connector-linear` lets FDEKit agents create Linear issues through both `linear.issue.create` and the common `issue.create` capability. Local mode returns deterministic issues; API mode calls Linear GraphQL.

## Who should use this package

- Deployment authors who want issue creation in Linear.
- Recipe authors using the common `issue.create` capability across GitHub, Jira, and Linear.
- Connector contributors maintaining Linear API behavior and local-mode parity.

Choose GitHub or Jira connectors when the customer issue tracker is not Linear.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { linearConnector } from '@fdekit/connector-linear';

const linear = linearConnector({
  mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local',
  teamId: process.env.LINEAR_TEAM_ID,
});

export default defineDeployment({
  name: 'linear-escalation',
  environment: 'local',
  connectors: { linear },
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    // ...
  },
});
```

Set `LINEAR_API_KEY` and optionally `LINEAR_TEAM_ID` for API mode.

## Public API surface

Import from the package root:

```ts
import { linearConnector } from '@fdekit/connector-linear';
import type { LinearConnectorOptions, CreateLinearIssueResult } from '@fdekit/connector-linear';
```

Root exports include `linearConnector`, `LinearConnectorConfig`, `LinearConnectorMode`, `LinearConnectorOptions`, `CreateLinearIssueArgs`, and `CreateLinearIssueResult`. The connector family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#connectors).

## Stability/backward-compat notes

`@fdekit/connector-linear` is public but pre-1.0. The package-root factory, option/result types, local/API modes, `linear.issue.create`, and `issue.create` tool names are compatibility-sensitive.

Subpath imports are internal. Keep local mode deterministic so demos and tests do not require Linear credentials.

## See also

- Connector authoring contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- Issue connector neighbors: [GitHub](../github/README.md), [Jira](../jira/README.md)
- Connector family: [customer API](../customer-api/README.md), [codebase](../codebase/README.md), [Slack](../slack/README.md), [Postgres](../postgres/README.md), [k6](../k6/README.md), [HubSpot](../hubspot/README.md), [Salesforce](../salesforce/README.md)
