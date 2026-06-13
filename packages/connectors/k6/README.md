# @fdekit/connector-k6

## Purpose

`@fdekit/connector-k6` lets FDEKit agents run governed load-test scenarios through `loadtest.run`. Local mode returns deterministic threshold-oriented results; k6 mode invokes the k6 CLI.

## Who should use this package

- Deployment authors validating customer API readiness with load-test evidence.
- Recipe authors building performance, smoke-test, or rollout readiness workflows.
- Connector contributors maintaining k6 command construction, result parsing, and local-mode parity.

Choose `@fdekit/environment-docker` or `@fdekit/environment-floci` when you need to start the customer-like system around the test.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { k6Connector } from '@fdekit/connector-k6';

const k6 = k6Connector({
  mode: process.env.FDEKIT_CONNECTOR_MODE === 'k6' ? 'k6' : 'local',
  targetUrl: process.env.CUSTOMER_API_URL ?? 'http://localhost:8787',
  scriptPath: './load-tests/customer-api-smoke.js',
});

export default defineDeployment({
  name: 'customer-api-load-test',
  environment: 'local',
  connectors: { k6 },
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    // ...
  },
});
```

Set `K6_BINARY` only when the k6 executable is not available as `k6`.

## Public API surface

Import from the package root:

```ts
import { k6Connector } from '@fdekit/connector-k6';
import type { K6ConnectorOptions, K6RunResult } from '@fdekit/connector-k6';
```

Root exports include `k6Connector`, `K6ConnectorConfig`, `K6ConnectorMode`, `K6ConnectorOptions`, `K6RunArgs`, `K6RunResult`, `K6Scenario`, `K6CommandInvocation`, and `K6CommandResult`. The connector family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#connectors).

## Stability/backward-compat notes

`@fdekit/connector-k6` is public but pre-1.0. The package-root factory, option/result types, local/k6 modes, and `loadtest.run` tool name are compatibility-sensitive.

Subpath imports are internal. Keep local mode deterministic so demos and tests do not require the k6 binary.

## See also

- Connector authoring contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- Local environment packages: [Docker](../../environments/docker/README.md), [Floci](../../environments/floci/README.md)
- Connector family: [customer API](../customer-api/README.md), [codebase](../codebase/README.md), [GitHub](../github/README.md), [Slack](../slack/README.md), [Jira](../jira/README.md), [Linear](../linear/README.md), [Postgres](../postgres/README.md), [HubSpot](../hubspot/README.md), [Salesforce](../salesforce/README.md)
