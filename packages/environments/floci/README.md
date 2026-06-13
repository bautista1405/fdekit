# @fdekit/environment-floci

## Purpose

`@fdekit/environment-floci` describes and operates a local cloud-emulator environment around an FDEKit deployment. It supports AWS, Azure, and GCP Floci modes, generates start/stop/seed commands, injects SDK environment variables, records service evidence, and supports `fdekit env *` commands.

Use it when the customer-like API talks to local cloud services instead of only local processes or Docker Compose services.

## Who should use this package

- Deployment authors who need local cloud emulation around an agent workflow.
- Recipe authors packaging AWS, Azure, or GCP emulator setup with customer API evidence.
- Contributors maintaining Floci defaults, Docker command generation, SDK env injection, and evidence metadata.

Choose a connector package when the agent needs to call a system. Choose this package when the operator needs to start, seed, check, or describe the cloud-like system around the agent.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { flociEnvironment } from '@fdekit/environment-floci';

export default defineDeployment({
  name: 'support-triage-floci',
  environment: 'local',
  runtimeEnvironment: flociEnvironment({
    cloud: 'aws',
    services: ['s3', 'sqs', 'dynamodb'],
    customerApi: {
      url: process.env.CUSTOMER_API_URL ?? 'http://localhost:8787',
      healthUrl: 'http://localhost:8787/health',
    },
    seed: {
      command: 'npm run seed:floci',
      description: 'Seed local cloud resources and customer records.',
    },
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
import { flociEnvironment } from '@fdekit/environment-floci';
import type { FlociCloudProvider, FlociEnvironmentOptions } from '@fdekit/environment-floci';
```

Root exports include `flociEnvironment`, Floci cloud/default/config/definition types, command helpers such as `dockerStartCommand`, cloud helpers such as `getFlociCloudDefaults`, and service/storage utility types. The environment family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#environments).

## Stability/backward-compat notes

`@fdekit/environment-floci` is public but pre-1.0. The package-root factory, option/config types, cloud defaults, command names, environment kind `local-floci`, SDK env injection, and evidence shape are compatibility-sensitive.

Subpath imports are internal. Keep this package operator-facing; agents should still call customer systems through connectors.

## Provider notes

`cloud: 'azure'` uses `floci/floci-az:latest` on port `4577`, injects the documented Azure storage connection string shape, and exposes endpoint helpers for Blob, Queue, Table, Functions, App Configuration, Key Vault, Event Hubs, and Cosmos engines. Services such as `functions`, `eventhub`, `cosmos-mongo`, `cosmos-postgres`, `cosmos-cassandra`, and `cosmos-gremlin` automatically mount the Docker socket because Floci AZ runs those engines through Docker. Cosmos engine service names also set the matching `FLOCI_AZ_SERVICES_COSMOS_ENGINES_*_ENABLED=true` flag, which callers can override with `env`.

`cloud: 'gcp'` uses `floci/floci-gcp:latest` on port `4588`, injects the documented GCP emulator host variables, and maps `projectId` into both `FLOCI_GCP_DEFAULT_PROJECT_ID` and `GOOGLE_CLOUD_PROJECT`. Services such as `kafka` or `managed-kafka` automatically mount the Docker socket for Floci GCP Managed Kafka, but they do not add Azure-native port mappings.

Use `volumes` when the emulator container needs a persisted host directory, for example `volumes: ['./data:/app/data']` with `persistentPath: '/app/data'`.

## See also

- Environment contract: [@fdekit/core](../../core/README.md)
- CLI environment commands: [fdekit](../../cli/README.md)
- Runtime artifact/evidence APIs: [@fdekit/runtime](../../runtime/README.md)
- Environment neighbor: [Docker](../docker/README.md)
- Local environment cookbook: [Local Environment Cookbook](../../../docs/cookbook/local-environments.md)
