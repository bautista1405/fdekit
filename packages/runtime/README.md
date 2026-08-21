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
`validateDeployment()` and `fdekit validate` report an `artifacts.client` error when the
adapter is missing or incomplete, before any S3 artifact write is attempted.

## HTTP artifact storage

The HTTP adapter sends runtime evidence to an external control plane through the same
`ArtifactStore` interface:

```ts
import { defineDeployment } from '@fdekit/core';

export default defineDeployment({
  name: 'managed-review-worker',
  artifacts: {
    kind: 'http',
    endpoint: 'https://control.example.com/api/ingest',
    tokenEnv: 'FDEKIT_WORKER_TOKEN',
  },
  providers: {},
  agents: {},
});
```

The token is resolved when the store is created and omitted from deployment snapshots.
Requests identify HTTP artifact protocol version 1 and the producing runtime version.
The receiving service must authenticate and authorize every operation; producer metadata
does not grant authority.

The adapter currently performs synchronous requests and surfaces failures. It does not yet
provide a durable local spool, retries, idempotent delivery, checksums, or immutable evidence
versions, so it must not be described as surviving worker or network failure. See the
[HTTP Artifact Store Protocol](../../docs/specs/http-artifact-store-protocol.md) for request
shapes, compatibility behavior, and the explicit durability boundary.

Evidence that must survive worker or network failure should use the explicit
`ArtifactDeliveryQueue`. `createFileArtifactDeliveryQueue()` commits immutable,
checksummed versions to a local spool before
`createHttpArtifactDeliveryTarget()` attempts delivery. Failed and out-of-order
versions remain pending across restart; accepted or duplicate acknowledgements
become immutable receipts. See [Durable Artifact Delivery](../../docs/specs/artifact-delivery.md).

## Durable local sessions

Every agent run now records events while it is alive under
`artifacts/sessions/<runId>/events.jsonl`. The event log is append-only and is
the source of truth; its projection can be rebuilt after a process restart.

```ts
import { createFileSessionStore } from '@fdekit/runtime/sessions';

const sessions = createFileSessionStore({ projectDir: process.cwd() });
const run = await sessions.getProjection(runId);
const newEvents = await sessions.readEvents(runId, { afterRevision: 12 });
```

The local store supports optimistic revisions, idempotent append retries,
validated state transitions, corruption detection, immutable snapshots, and
single-sync event batches. Agent telemetry is batched between immediate lifecycle
boundaries. Structured `needs_input` pauses validate typed answers before
resume. Optional input gates bind an answer to intended principals, a deadline,
and an ephemeral one-time capability whose raw value is never persisted.
Cancellation, retry, expiry, tombstone, and purge are explicit APIs.
Pass a `SessionStore` to `runAgent()` or `resumeAgentRun()` to supply a hosted
implementation. This is a storage interface, not an OSS application server.
See the [Session Store specification](../../docs/specs/session-store.md).

`@fdekit/runtime/sessions` also provides worker lease acquisition, renewal,
release, fencing checks, checkpoints, heartbeats, inbox/outbox helpers, and a
durable external-action lifecycle. `appendSessionEventWithOutbox()` requires a
store with an atomic `appendBatch()` implementation and fails closed otherwise.
The hosted queue and scheduler remain outside this package.

## Disposable execution

`@fdekit/runtime/execution` provides opt-in `ExecutionBackend`,
`WorkspaceLease`, and `CredentialBroker` contracts plus constrained local
implementations. The local backend allows only explicitly configured
executables and inherited environment variables, bounds time and output, and
cleans up disposable workspaces. Environment credential leases expire and do
not serialize secret material.

The local backend is trusted-host execution, not a sandbox. It reports
filesystem, process, and network isolation as unavailable and rejects requests
that require them. `createDockerExecutionBackend()` supplies a hardened,
network-disabled container path, while `defineExecutionTool()` routes backend
commands through the ordinary governed tool edge with automatic cleanup.
See [Execution Backends And Credential Leases](../../docs/specs/execution-backends.md).

## Governed deterministic actions

Automation that already has exact tool arguments should use
`executeGovernedToolSequence()` instead of invoking connector handlers. The
sequence passes through normal runtime schemas, environments, policies,
approvals, audit, trace, and durable session recording without model
re-planning. Approval resume continues remaining calls and never replays a
completed write. See [Governed Exact Tool Sequences](../../docs/specs/governed-tool-sequences.md).

## Policy-aware context planning

The focused `@fdekit/runtime/context` entrypoint exposes the pure planning
primitives. `runAgent({ contextPlanning })` makes them load-bearing for every
provider step: it authorizes source identities, selects the configured endpoint
and model, compiles `ModelContext`, enforces selected tools and run budgets, and
records a content-free `context.plan.selected` event.

```ts
import {
  authorizeRetrieval,
  planStepContext,
  selectInferenceTarget,
} from '@fdekit/runtime/context';
```

Each plan includes a selected/excluded manifest for audit and evals. Provider
planner helpers use `ProviderPlanContext.modelContext` and exclude host-only
input, policy, endpoint, credential references, and raw tool history from the
wire payload. Runs paused for approval persist the exact governing plan and must
resume with the same effective policy and inference route. See the
[context planning specification](../../docs/specs/context-planning.md).

Repeated semantic items are deduplicated. Explicit host-produced compressed
variants can be selected without hidden summarization calls, with method and
token savings recorded in the manifest. Runtime checks cover cumulative
latency, duration, tool-call, cost, and delegation reservation limits.

Planned runs also pass the effective output-token cap to provider requests and
append one `UsageMeasurement` per provider step. OpenAI, Anthropic, Google, and
Ollama normalize their native token counters; adapters that report none produce
an explicit `unknown` measurement without invented token or cost values. Cost
is estimated only from pricing declared on the selected target. Total input
includes cache reads and writes, while total output includes reasoning; optional
cache-specific rates avoid double counting. A hard `maxCost` rejects unpriced
targets before inference. These controls are opt-in and do not add fields to the
default `fde.config.ts` scaffold.

## Local intelligence

`@fdekit/runtime/intelligence` provides deterministic in-process primitives for
source-aware chunking, authorization-gated exact/full-text/vector/hybrid
retrieval, scoped working and episodic memory, provenance-aware entity
knowledge, exact policy/tenant/source-safe caching, and usage/cost ledgers.
Embeddings are caller-supplied; these helpers never make a hidden model call.
See [Local Intelligence Primitives](../../docs/specs/local-intelligence.md).

## Project-local skills

`loadProjectSkills()` from `@fdekit/runtime/skills` validates manifests under
`fdekit/skills`, blocks path/symlink escapes, and verifies the declared SHA-256
entrypoint digest. It deliberately does not import or execute skill code. Use
`evaluateProjectSkillGrant()` from `@fdekit/core` to intersect requested
capabilities and sources with the exact effective policy.
`runDocumentationSkillShadow()` is the isolated diff-only/shadow pilot; it has
no apply or publication path. See
[Project-Local Skill Contracts](../../docs/specs/project-skills.md).

## Public API surface

Import from the package root for the full runtime surface:

```ts
import { executeGovernedToolSequence, runAgent, runEvals, createArtifactStore } from '@fdekit/runtime';
```

Focused runtime entrypoints are available through package exports:

```ts
import { runAgent } from '@fdekit/runtime/agents';
import { compileDeployment } from '@fdekit/runtime/deployments';
import { planStepContext } from '@fdekit/runtime/context';
import { LocalRetrievalIndex } from '@fdekit/runtime/intelligence';
import { loadProjectSkills } from '@fdekit/runtime/skills';
import { createArtifactStore } from '@fdekit/runtime/artifacts';
import { runGrader } from '@fdekit/runtime/grader';
import { createFileSessionStore } from '@fdekit/runtime/sessions';
```

The API reference documents public exports, including config loading, agent execution, durable sessions, validation, compilation, snapshots, diffs, evals, macro evals, governance artifacts, trace/report renderers, artifact stores, and provider runtime contracts: [Runtime API Reference](../../docs/api/runtime.md).

## Stability/backward-compat notes

`@fdekit/runtime` is public but pre-1.0. The package root and explicit package exports are the compatibility boundary. Runtime artifacts are intentionally filesystem-first today, but artifact and session store contracts should be treated as public when imported from `@fdekit/runtime`, `@fdekit/runtime/artifacts`, or `@fdekit/runtime/sessions`.

Subpath imports from `src`, `dist`, `helpers`, or `interfaces` are internal. Runtime behavior that changes trace, approval, audit, eval, snapshot, or report artifact shapes should update the API reference and migration docs.

## See also

- Authoring contracts: [@fdekit/core](../core/README.md)
- CLI command workflow: [fdekit](../cli/README.md)
- Static dashboard renderer: [@fdekit/console](../console/README.md)
- Credential-free provider adapter: [@fdekit/provider-mock](../providers/mock/README.md)
- Runtime package API: [Runtime API Reference](../../docs/api/runtime.md)
- Deployment versioning and diffs: [Versioning And Migration Notes](../../docs/cookbook/versioning-and-migrations.md)
