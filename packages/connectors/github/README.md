# @fdekit/connector-github

## Purpose

`@fdekit/connector-github` lets FDEKit agents create engineering issues through a stable `issue.create` tool. Local mode returns deterministic issue artifacts; API mode calls the GitHub REST API.

## Who should use this package

- Deployment authors who want issue creation in GitHub.
- Recipe authors using the common `issue.create` capability across GitHub, Jira, and Linear.
- Connector contributors maintaining GitHub API behavior and local-mode parity.

Choose Jira or Linear connectors when the customer issue tracker is not GitHub.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { githubConnector } from '@fdekit/connector-github';

const github = githubConnector({
  mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local',
  repository: process.env.GITHUB_REPOSITORY ?? 'company/support-triage',
});

export default defineDeployment({
  name: 'github-escalation',
  environment: 'local',
  connectors: { github },
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    // ...
  },
});
```

Set `GITHUB_TOKEN` and `GITHUB_REPOSITORY` for API mode.

## Public API surface

Import from the package root:

```ts
import { githubConnector } from '@fdekit/connector-github';
import type { GitHubConnectorOptions, CreateIssueArgs } from '@fdekit/connector-github';
```

Root exports include `githubConnector`, `GitHubConnectorConfig`, `GitHubConnectorMode`, `GitHubConnectorOptions`, `CreateIssueArgs`, and `CreateIssueResult`. The connector family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#connectors).

## Stability/backward-compat notes

`@fdekit/connector-github` is public but pre-1.0. The package-root factory, option/result types, local/API modes, and `issue.create` tool name are compatibility-sensitive.

Subpath imports are internal. Keep local mode deterministic so demos and tests do not require GitHub credentials.

## See also

- Connector authoring contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- Issue connector neighbors: [Jira](../jira/README.md), [Linear](../linear/README.md)
- Connector family: [customer API](../customer-api/README.md), [codebase](../codebase/README.md), [Slack](../slack/README.md), [Postgres](../postgres/README.md), [k6](../k6/README.md), [HubSpot](../hubspot/README.md), [Salesforce](../salesforce/README.md)
