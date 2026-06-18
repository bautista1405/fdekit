# @fdekit/runtime

## Purpose

`@fdekit/runtime` loads FDEKit deployment configs, executes agent runs, validates deployment structure, writes artifacts, manages approvals and audit logs, runs evals, renders reports and trace viewers, and produces deployment snapshots/diffs.

Use runtime when you are operating a deployment programmatically. Keep deployment authoring contracts in `@fdekit/core` and command orchestration in `fdekit`.

## Who should use this package

- CLI contributors implementing commands.
- Automation authors who want to call FDEKit without shelling out to the CLI.
- Runtime integrators wiring provider registries, artifact stores, evals, approvals, traces, reports, or deployment diffs.

Choose `@fdekit/core` when you are writing config helpers or public deployment types. Choose `@fdekit/cli` when the packaged commands already do what you need.

## 5-minute quick example

```ts
import * as path from 'node:path';
import {
  loadDeployment,
  requireConfigFile,
  runAgent,
  validateDeployment,
} from '@fdekit/runtime';

const configPath = await requireConfigFile(process.cwd());
const projectDir = path.dirname(configPath);
const deployment = await loadDeployment(configPath);

const validation = validateDeployment(deployment, { strict: true });
if (validation.issues.some((issue) => issue.severity === 'error')) {
  throw new Error('Deployment is not ready to run');
}

const result = await runAgent({
  deployment,
  projectDir,
  agentName: 'supportTriage',
  input: { task: 'Triage ticket T-1001' },
  strict: true,
});

console.log(result.status, result.finalAnswer);
```

Config discovery checks the current directory and its ancestors for `fde.config.ts`. At each level it also checks `./fdekit/fde.config.ts`; new file-creating workflows without a config use `fdekit/` under the nearest `package.json` or Git project root.

## S3 artifact storage

FDEKit keeps cloud SDKs optional. To select S3 in `fde.config.ts`, inject a client with
`putObject`, `getObject`, and `listObjectsV2`; a bucket without a client is not a complete
artifact-store definition.

```ts
import type { S3ArtifactClient } from '@fdekit/runtime';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });

const client: S3ArtifactClient = {
  putObject: (input) => s3.send(new PutObjectCommand(input)),
  getObject: (input) => s3.send(new GetObjectCommand(input)),
  listObjectsV2: (input) => s3.send(new ListObjectsV2Command(input)),
};
```

Pass the adapter as `artifacts: { kind: 's3', bucket, prefix?, region?, client }`. The same
minimal interface works with the AWS SDK, MinIO, LocalStack, or a wrapped enterprise client.

## Public API surface

Import from the package root for the full runtime surface:

```ts
import { runAgent, runEvals, createArtifactStore } from '@fdekit/runtime';
```

Focused runtime entrypoints are available through package exports:

```ts
import { runAgent } from '@fdekit/runtime/agents';
import { compileDeployment } from '@fdekit/runtime/deployments';
import { createArtifactStore } from '@fdekit/runtime/artifacts';
```

The API reference documents public exports, including config loading, agent execution, validation, compilation, snapshots, diffs, evals, macro evals, governance artifacts, trace/report renderers, artifact stores, and provider runtime contracts: [Runtime API Reference](../../docs/api/runtime.md).

## Stability/backward-compat notes

`@fdekit/runtime` is public but pre-1.0. The package root and explicit package exports are the compatibility boundary. Runtime artifacts are intentionally filesystem-first today, but artifact store contracts should be treated as public when imported from `@fdekit/runtime` or `@fdekit/runtime/artifacts`.

Subpath imports from `src`, `dist`, `helpers`, or `interfaces` are internal. Runtime behavior that changes trace, approval, audit, eval, snapshot, or report artifact shapes should update the API reference and migration docs.

## See also

- Authoring contracts: [@fdekit/core](../core/README.md)
- CLI command workflow: [fdekit](../cli/README.md)
- Static dashboard renderer: [@fdekit/console](../console/README.md)
- Credential-free provider adapter: [@fdekit/provider-mock](../providers/mock/README.md)
- Runtime package API: [Runtime API Reference](../../docs/api/runtime.md)
- Deployment versioning and diffs: [Versioning And Migration Notes](../../docs/cookbook/versioning-and-migrations.md)
