# @fdekit/environment-docker

## Purpose

`@fdekit/environment-docker` describes and operates a local Docker Compose customer-like environment around an FDEKit deployment. It produces start/stop/seed commands, health checks, service evidence, and endpoint metadata for `fdekit env *` commands and dashboard/report evidence.

Use it for local container stacks such as customer APIs, databases, queues, caches, workers, or gateways.

## Who should use this package

- Deployment authors who need repeatable local customer-like infrastructure.
- Recipe authors packaging Docker Compose setup alongside an agent workflow.
- Contributors maintaining environment command generation and evidence metadata.

Choose a connector package when the agent needs to call a system. Choose this package when the operator needs to start, seed, check, or describe the system around the agent.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { dockerEnvironment } from '@fdekit/environment-docker';

export default defineDeployment({
  name: 'support-triage-docker',
  environment: 'local',
  runtimeEnvironment: dockerEnvironment({
    composeFile: './docker-compose.local.yml',
    projectName: 'customer-support-stack',
    services: ['customer-api', 'postgres', 'redis'],
    customerApi: {
      serviceName: 'customer-api',
      url: process.env.CUSTOMER_API_URL ?? 'http://localhost:8787',
      healthUrl: 'http://localhost:8787/health',
    },
    seed: 'npm run seed:docker',
  }),
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    // ...
  },
});
```

Then run:

```bash
fdekit env start
fdekit env seed
fdekit env doctor
fdekit env describe
```

## Public API surface

Import from the package root:

```ts
import { dockerEnvironment } from '@fdekit/environment-docker';
import type { DockerEnvironmentOptions, DockerEnvironmentDefinition } from '@fdekit/environment-docker';
```

Root exports include `dockerEnvironment`, Docker environment option/config/definition types, command helpers such as `dockerComposeStartCommand`, and Docker Compose utility types. The environment family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#environments).

## Stability/backward-compat notes

`@fdekit/environment-docker` is public but pre-1.0. The package-root factory, option/config types, command names, environment kind `local-docker`, and evidence shape are compatibility-sensitive.

Subpath imports are internal. Keep this package operator-facing; agents should still call customer systems through connectors.

## See also

- Environment contract: [@fdekit/core](../../core/README.md)
- CLI environment commands: [fdekit](../../cli/README.md)
- Runtime artifact/evidence APIs: [@fdekit/runtime](../../runtime/README.md)
- Environment neighbor: [Floci](../floci/README.md)
- Local environment cookbook: [Local Environment Cookbook](../../../docs/cookbook/local-environments.md)
