# @fdekit/connector-slack

## Purpose

`@fdekit/connector-slack` lets FDEKit agents send escalation messages through `slack.message`. Local mode returns deterministic message artifacts; API mode calls Slack `chat.postMessage`.

## Who should use this package

- Deployment authors who need human notification or escalation evidence.
- Recipe authors adding Slack notifications to support, incident, or approval workflows.
- Connector contributors maintaining Slack API behavior and local-mode parity.

Choose a custom connector when the notification target is not Slack-compatible.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { slackConnector } from '@fdekit/connector-slack';

const slack = slackConnector({
  mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local',
  defaultChannel: process.env.SLACK_CHANNEL_ID ?? '#support-escalations',
});

export default defineDeployment({
  name: 'slack-escalation',
  environment: 'local',
  connectors: { slack },
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    // ...
  },
});
```

Set `SLACK_BOT_TOKEN` and `SLACK_CHANNEL_ID` for API mode.

## Public API surface

Import from the package root:

```ts
import { slackConnector } from '@fdekit/connector-slack';
import type { SlackConnectorOptions, SlackMessageResult } from '@fdekit/connector-slack';
```

Root exports include `slackConnector`, `SlackConnectorConfig`, `SlackConnectorMode`, `SlackConnectorOptions`, `SlackMessageArgs`, and `SlackMessageResult`. The connector family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#connectors).

## Stability/backward-compat notes

`@fdekit/connector-slack` is public but pre-1.0. The package-root factory, option/result types, local/API modes, and `slack.message` tool name are compatibility-sensitive.

Subpath imports are internal. Keep local mode deterministic so demos and tests do not require Slack credentials.

## See also

- Connector authoring contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- Support-triage neighbors: [customer API](../customer-api/README.md), [GitHub](../github/README.md)
- Connector family: [codebase](../codebase/README.md), [Jira](../jira/README.md), [Linear](../linear/README.md), [Postgres](../postgres/README.md), [k6](../k6/README.md), [HubSpot](../hubspot/README.md), [Salesforce](../salesforce/README.md)
