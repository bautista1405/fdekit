# Local Environment Cookbook

FDEKit environment packages describe the customer-like runtime around an agent deployment. They are not connectors.

The boundary is:

```txt
FDEKit agent -> connector -> customer API URL -> customer app -> local/cloud environment
```

API reference: [`ConnectorDefinition`](../api/core.md#connectordefinition) and [`DeploymentEnvironmentDefinition`](../api/core.md#deploymentenvironmentdefinition) are the two contracts on either side of this boundary.

For Floci, that means the customer API talks to the local cloud emulator. FDEKit still talks to the customer API through `CUSTOMER_API_URL`.

The preferred wiring is a single source of truth: declare the URL once on the runtime environment and let the connector reference the exported endpoint.

```ts
import { environmentEndpoint } from '@fdekit/core';

connectors: {
  customerApi: customerApiConnector({
    baseUrl: environmentEndpoint('customer-api'),
  }),
},
```

The reference resolves at tool-call time from the runtime environment's exported endpoints (`evidence.endpoints`), so the connector can never drift from the environment. Both `dockerEnvironment` and `flociEnvironment` export a `customer-api` endpoint when `customerApi.url` is set. `fdekit validate` errors when a referenced endpoint is not exported.

When you wire URLs manually instead, `fdekit validate` cross-checks the wiring:

- It warns when the `customer-api` connector base URL disagrees with the runtime environment's declared customer API URL, since agent tool calls and environment health checks would target different endpoints.
- It warns when a connector runs in live `api` mode, or targets a non-local URL, while `environment` is still `local`, since environment policies and audit labels would no longer match the live integration.

The `customer-api` connector also resolves `CUSTOMER_API_URL` at call time, so changing the env var takes effect without re-evaluating the config.

## Environment Types

The current contract leaves room for three environment families:

| Kind | Package Shape | Purpose |
| --- | --- | --- |
| `local-process` | future package | Simple local processes, such as `npm run api`, without cloud emulation. |
| `local-docker` | `@fdekit/environment-docker` | Local Docker Compose customer stacks. |
| `local-floci` | `@fdekit/environment-floci` | Local customer cloud emulation through Floci. |
| `prod-api-cloud` | future `packages/environments/{cloud-provider}` | Production or staging API/cloud environments without pretending they are local. |

Docker Compose and Floci are implemented today.

## Docker Compose Setup

Use this when the customer-like system is a local container stack: API, database, queue, cache, worker, or gateway.

Install the package in a deployment project:

```bash
npm install @fdekit/environment-docker
```

API reference: [`DeploymentEnvironmentDefinition`](../api/core.md#deploymentenvironmentdefinition) is the core contract implemented by environment packages.

Add it to `fde.config.ts`:

```ts
import { defineAgent, defineDeployment, environmentEndpoint } from '@fdekit/core';
import { customerApiConnector } from '@fdekit/connector-customer-api';
import { dockerEnvironment } from '@fdekit/environment-docker';

const customerApiUrl = process.env.CUSTOMER_API_URL ?? 'http://localhost:8787';

export default defineDeployment({
  name: 'support-triage-docker',
  environment: 'local',
  runtimeEnvironment: dockerEnvironment({
    composeFile: './docker-compose.local.yml',
    projectName: 'customer-support-stack',
    services: ['customer-api', 'postgres', 'redis'],
    customerApi: {
      serviceName: 'customer-api',
      url: customerApiUrl,
      healthUrl: `${customerApiUrl}/health`,
      replicas: Number(process.env.CUSTOMER_API_REPLICAS ?? 1),
    },
    seed: {
      command: 'npm run seed:docker',
    },
  }),
  connectors: {
    customerApi: customerApiConnector({
      // Resolves from the runtime environment's exported customer-api endpoint
      // at tool-call time, so the connector cannot drift from the environment.
      baseUrl: environmentEndpoint('customer-api'),
    }),
  },
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    supportTriage: defineAgent({
      provider: 'mock',
      instructions: './agents/support-triage.md',
    }),
  },
});
```

API reference: [`defineDeployment`](../api/core.md#definedeployment), [`defineAgent`](../api/core.md#defineagent), [`environmentEndpoint`](../api/core.md#environmentendpoint), [`DeploymentEnvironmentDefinition`](../api/core.md#deploymentenvironmentdefinition), and [`EnvironmentCommandDefinition`](../api/core.md#environmentcommanddefinition).

Run the environment first:

```bash
fdekit env start
fdekit env seed
fdekit env doctor
fdekit env describe
```

CLI reference: [`fdekit env start`](../api/cli.md#fdekit-env-start), [`fdekit env seed`](../api/cli.md#fdekit-env-seed), [`fdekit env doctor`](../api/cli.md#fdekit-env-doctor), and [`fdekit env describe`](../api/cli.md#fdekit-env-describe).

## Floci Setup

Install the package in a deployment project:

```bash
npm install @fdekit/environment-floci
```

API reference: [`DeploymentEnvironmentDefinition`](../api/core.md#deploymentenvironmentdefinition) is the core contract implemented by environment packages.

Add it to `fde.config.ts`:

```ts
import { defineAgent, defineDeployment } from '@fdekit/core';
import { customerApiConnector } from '@fdekit/connector-customer-api';
import { flociEnvironment } from '@fdekit/environment-floci';

export default defineDeployment({
  name: 'support-triage',
  environment: 'local',
  runtimeEnvironment: flociEnvironment({
    cloud: 'aws',
    services: ['s3', 'sqs', 'dynamodb'],
    endpoint: process.env.FLOCI_AWS_ENDPOINT ?? 'http://localhost:4566',
    customerApi: {
      url: process.env.CUSTOMER_API_URL ?? 'http://localhost:8787',
      healthUrl: 'http://localhost:8787/health',
      replicas: Number(process.env.CUSTOMER_API_REPLICAS ?? 1),
    },
    seed: {
      command: 'npm run seed:floci',
      description: 'Seed local cloud resources and customer records.',
    },
  }),
  connectors: {
    customerApi: customerApiConnector({
      baseUrl: process.env.CUSTOMER_API_URL ?? 'http://localhost:8787',
    }),
  },
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    supportTriage: defineAgent({
      provider: 'mock',
      instructions: './agents/support-triage.md',
    }),
  },
});
```

API reference: [`defineDeployment`](../api/core.md#definedeployment), [`defineAgent`](../api/core.md#defineagent), [`DeploymentEnvironmentDefinition`](../api/core.md#deploymentenvironmentdefinition), and [`EnvironmentHealthCheckDefinition`](../api/core.md#environmenthealthcheckdefinition).

Run the environment first, then the normal agent loop:

```bash
fdekit env start
fdekit env seed
fdekit env doctor

fdekit doctor
fdekit validate --strict
fdekit run supportTriage
fdekit eval run
fdekit eval macro
fdekit console
```

CLI reference: [`fdekit env start`](../api/cli.md#fdekit-env-start), [`fdekit env seed`](../api/cli.md#fdekit-env-seed), [`fdekit env doctor`](../api/cli.md#fdekit-env-doctor), [`fdekit validate`](../api/cli.md#fdekit-validate-json-strict), [`fdekit run`](../api/cli.md#fdekit-run-agent-input-json-strict), [`fdekit eval run`](../api/cli.md#fdekit-eval-run), [`fdekit eval macro`](../api/cli.md#fdekit-eval-macro-min-frequency-n), and [`fdekit console`](../api/cli.md#fdekit-console).

### Cloud-Specific Floci Defaults

`flociEnvironment()` uses the real defaults from the Floci cloud emulator repos:

| Cloud | Image | Port | SDK env injected into environment commands |
| --- | --- | --- | --- |
| AWS | `floci/floci:latest` | `4566` | `AWS_ENDPOINT_URL`, `AWS_DEFAULT_REGION`, dummy AWS credentials |
| Azure | `floci/floci-az:latest` | `4577` | `AZURE_ENDPOINT_URL`, `AZURE_STORAGE_CONNECTION_STRING` |
| GCP | `floci/floci-gcp:latest` | `4588` | `PUBSUB_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, `DATASTORE_EMULATOR_HOST`, `STORAGE_EMULATOR_HOST`, `SECRET_MANAGER_EMULATOR_HOST`, `GOOGLE_CLOUD_PROJECT` |

AWS Docker-backed services such as Lambda, RDS, ElastiCache, OpenSearch, MSK, ECS, EC2, EKS, and CodeBuild require the Docker socket. FDEKit detects those service names and mounts `/var/run/docker.sock` in the created Docker command.

```ts
runtimeEnvironment: flociEnvironment({
  cloud: 'aws',
  services: ['s3', 'sqs', 'lambda', 'rds'],
  storageMode: 'hybrid',
  persistentPath: '/app/data',
  dockerNetwork: 'customer_default',
});
```

API reference: [`DeploymentEnvironmentDefinition`](../api/core.md#deploymentenvironmentdefinition) and [`EnvironmentServiceDefinition`](../api/core.md#environmentservicedefinition).

Azure Functions, Event Hubs, Azure SQL, AKS, and Docker-backed Cosmos DB engines also require Docker. Use Azure mode when the customer API expects Azure-compatible services:

```ts
runtimeEnvironment: flociEnvironment({
  cloud: 'azure',
  services: ['blob', 'queue', 'table', 'functions'],
  hostname: 'floci-az',
  storageMode: 'hybrid',
});
```

API reference: [`DeploymentEnvironmentDefinition`](../api/core.md#deploymentenvironmentdefinition) and [`EnvironmentServiceDefinition`](../api/core.md#environmentservicedefinition).

GCP mode exposes the standard emulator host variables expected by Google SDKs:

```ts
runtimeEnvironment: flociEnvironment({
  cloud: 'gcp',
  services: ['pubsub', 'firestore', 'gcs', 'secretmanager'],
  projectId: 'customer-local',
  hostname: 'floci-gcp',
  storageMode: 'hybrid',
});
```

API reference: [`DeploymentEnvironmentDefinition`](../api/core.md#deploymentenvironmentdefinition) and [`EnvironmentServiceDefinition`](../api/core.md#environmentservicedefinition).

When the customer API runs in another container, set `hostname` to the Floci Compose service name and point the customer API at the container-resolvable endpoint. The FDEKit agent should still talk to the customer API through `CUSTOMER_API_URL`, not directly to Floci.

## Multi-Container and Replica Setups

FDEKit should not know every pod, replica, or container. It needs a stable API URL and useful evidence.

Use the environment config to record the shape:

```ts
runtimeEnvironment: flociEnvironment({
  cloud: 'aws',
  services: ['s3', 'sqs', 'dynamodb'],
  customerApi: {
    serviceName: 'customer-api',
    url: 'http://localhost:8787',
    healthUrl: 'http://localhost:8787/health',
    replicas: 3,
  },
});
```

API reference: [`DeploymentEnvironmentDefinition`](../api/core.md#deploymentenvironmentdefinition), [`EnvironmentEvidence`](../api/core.md#environmentevidence), and [`EnvironmentServiceDefinition`](../api/core.md#environmentservicedefinition).

If the customer API is behind Docker Compose, local Kubernetes, or a local gateway, point `CUSTOMER_API_URL` at the gateway/load-balanced endpoint.

## Custom Commands

The default Floci start command is a Docker command. For real customer stacks, prefer explicit commands:

```ts
runtimeEnvironment: flociEnvironment({
  cloud: 'aws',
  startCommand: {
    command: 'docker compose up -d floci customer-api',
    cwd: './infra/local',
  },
  stopCommand: {
    command: 'docker compose down',
    cwd: './infra/local',
  },
  seed: {
    command: 'npm run seed:local-cloud',
  },
});
```

API reference: [`EnvironmentCommandDefinition`](../api/core.md#environmentcommanddefinition) and [`DeploymentEnvironmentDefinition`](../api/core.md#deploymentenvironmentdefinition).

Long-running commands are allowed, but they should usually be run in their own terminal or wrapped in a detached command such as `docker compose up -d`.

## Why This Is Separate From Connectors

Connectors are agent-facing capabilities:

- `customer.get`
- `ticket.get`
- `issue.create`
- `slack.message`
- `postgres.query`

Environments are operator-facing runtime setup:

- start local cloud emulator,
- seed customer-like cloud state,
- check API/cloud health,
- record services, endpoints, and replicas for dashboard/report evidence.

Keeping that boundary clean prevents agents from depending on emulator-specific internals. The recipe remains portable: switch from local Floci to a real staging API by changing environment setup and `CUSTOMER_API_URL`, not agent logic.

## Next Step

If you just configured a local environment, run through the [Hybrid Local Plus Live Connectors Reference Architecture](../reference-architectures.md#hybrid-local-plus-live-connectors). Then use the [Production Hardening Guide](../production-hardening.md) before turning on strict mode or live write paths.
