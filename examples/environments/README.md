# Runtime-environment examples

Demonstrates FDEKit **runtime environments** — the customer-like runtime around a deployment that
`fdekit env` manages. This example wires **both** backends and lets you switch between them, so it's
the one place to see how `dockerEnvironment` and `flociEnvironment` work.

> For a full agent walkthrough see [`support-triage`](../support-triage). That example is kept
> intentionally simple (its customer API runs as a local `node` process via `npm run api`); this
> example is dedicated to the `runtimeEnvironment` feature.

## Backends

Pick one with `FDEKIT_ENV_BACKEND` (declared in [`fde.config.ts`](./fde.config.ts)):

| `FDEKIT_ENV_BACKEND` | Backend | What `env start` runs |
|---|---|---|
| `docker` (default) | `dockerEnvironment` | `docker compose up` — a stand-in `nginx` service on `:8080` |
| `floci` | `flociEnvironment` | the LocalStack-compatible `floci/floci` AWS emulator on `:4566` |

Both require **Docker running locally**.

## Try it

```bash
npm install

# Docker backend (default)
npm run fdekit:env:describe
npm run fdekit:env:start
npm run fdekit:env:doctor      # OK web … http://127.0.0.1:8080/
npm run fdekit:env:stop

# Floci backend
FDEKIT_ENV_BACKEND=floci npm run fdekit:env:describe
FDEKIT_ENV_BACKEND=floci npm run fdekit:env:start
FDEKIT_ENV_BACKEND=floci npm run fdekit:env:doctor   # OK floci … /_localstack/health
FDEKIT_ENV_BACKEND=floci npm run fdekit:env:stop
```

## The wiring

```ts
const backend = pick(process.env.FDEKIT_ENV_BACKEND, ['docker', 'floci'], 'docker');

const runtimeEnvironment =
  backend === 'floci'
    ? flociEnvironment({ cloud: 'aws', services: ['s3', 'sqs'] })
    : dockerEnvironment({
        services: ['web'],
        customerApi: { url: 'http://127.0.0.1:8080', healthUrl: 'http://127.0.0.1:8080/', serviceName: 'web', replicas: 1 },
      });
```

Both backends auto-generate a health check from the configured endpoint, so `fdekit env doctor`
confirms the service is actually live. For `floci`, switch `cloud` to `'azure'` or `'gcp'` for the
other emulator images.
