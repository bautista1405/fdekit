# @fdekit/connector-jira

## Purpose

`@fdekit/connector-jira` lets FDEKit agents create Jira issues through both `jira.issue.create` and the common `issue.create` capability. Local mode returns deterministic issues; API mode calls Jira Cloud REST.

## Who should use this package

- Deployment authors who want issue creation in Jira.
- Recipe authors using the common `issue.create` capability across GitHub, Jira, and Linear.
- Connector contributors maintaining Jira API behavior and local-mode parity.

Choose GitHub or Linear connectors when the customer issue tracker is not Jira.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { jiraConnector } from '@fdekit/connector-jira';

const jira = jiraConnector({
  mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local',
  projectKey: process.env.JIRA_PROJECT_KEY,
});

export default defineDeployment({
  name: 'jira-escalation',
  environment: 'local',
  connectors: { jira },
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    // ...
  },
});
```

Set `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and optionally `JIRA_PROJECT_KEY` for API mode.

## Public API surface

Import from the package root:

```ts
import { jiraConnector } from '@fdekit/connector-jira';
import type { JiraConnectorOptions, CreateJiraIssueResult } from '@fdekit/connector-jira';
```

Root exports include `jiraConnector`, `JiraConnectorConfig`, `JiraConnectorMode`, `JiraConnectorOptions`, `CreateJiraIssueArgs`, and `CreateJiraIssueResult`. The connector family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#connectors).

## Stability/backward-compat notes

`@fdekit/connector-jira` is public but pre-1.0. The package-root factory, option/result types, local/API modes, `jira.issue.create`, and `issue.create` tool names are compatibility-sensitive.

Subpath imports are internal. Keep local mode deterministic so demos and tests do not require Jira credentials.

## See also

- Connector authoring contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- Issue connector neighbors: [GitHub](../github/README.md), [Linear](../linear/README.md)
- Connector family: [customer API](../customer-api/README.md), [codebase](../codebase/README.md), [Slack](../slack/README.md), [Postgres](../postgres/README.md), [k6](../k6/README.md), [HubSpot](../hubspot/README.md), [Salesforce](../salesforce/README.md)
