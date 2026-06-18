# Maintainer Architecture

This page is for people changing FDEKit internals. For public import contracts, use the [Public API Reference](./api-reference.md). For supported package maturity, use the [Support Matrix](./support-matrix.md).

## Package Graph

FDEKit keeps authoring contracts, runtime execution, integration adapters, CLI scaffolding, and console rendering in separate packages.

```txt
fdekit CLI
  -> @fdekit/runtime
      -> @fdekit/core
  -> @fdekit/console
      -> @fdekit/runtime
      -> @fdekit/core
  -> @fdekit/provider-* for the built-in CLI provider registry

@fdekit/provider-*
  -> @fdekit/core

@fdekit/connector-*
  -> @fdekit/core

@fdekit/environment-*
  -> @fdekit/core
```

The direction matters:

- `@fdekit/core` owns authoring types and helpers. It should not depend on runtime, CLI, console, providers, connectors, or filesystem artifacts.
- `@fdekit/runtime` owns execution and the `ArtifactStore` contract. Local `artifacts/` is the default store. It should not depend on concrete provider, connector, or storage SDK packages.
- Provider packages turn `ProviderConfig` into `AgentProvider` adapters.
- Connector packages expose `ConnectorDefinition` and typed tools. Runtime only sees tools.
- `fdekit` owns command behavior, starter scaffolds, built-in catalog manifests, docs snippets, and the built-in provider registry used by CLI runs.
- `@fdekit/console` renders already-written artifacts. It should not execute agents or mutate deployment state.

## Source Map

| Area | Main Files | Owns |
| --- | --- | --- |
| Core authoring | `packages/core/src/definitions`, `packages/core/src/types`, `packages/core/src/policies`, `packages/core/src/evals`, `packages/core/src/schema` | Deployment, agent, connector, tool, provider, policy, eval, recipe, governance, and schema contracts. |
| Runtime execution | `packages/runtime/src/agents`, `packages/runtime/src/evals`, `packages/runtime/src/governance`, `packages/runtime/src/deployments`, `packages/runtime/src/artifacts.ts` | Config loading, provider loop, tool execution, policy enforcement, approvals, audit logs, traces, eval artifacts, snapshots, reports. |
| Provider adapters | `packages/providers/*/src/index.ts`, `helpers`, `interfaces` | Provider config helper plus runtime adapter. |
| Connector adapters | `packages/connectors/*/src/index.ts`, `helpers`, `interfaces` | Connector factory, tool schemas, local/API modes, connector-specific option and result types. |
| CLI commands | `packages/cli/src/index.ts`, `packages/cli/src/commands/*` | Command parsing and orchestration around runtime APIs. |
| CLI catalog | `packages/cli/src/catalog/*`, `packages/cli/src/catalog/connectors/*` | Typed manifests for providers, connectors, recipes, CLI help, add scaffolds, support matrix rows, docs snippets. |
| Recipes | `packages/cli/src/scaffolds/recipes/*` | Built-in project scaffolds, local files, config renderers, package/env patches, recipe install behavior. |
| Console | `packages/console/src/view-models`, `sections`, `html-shell`, `exports` | Static dashboard HTML and CSV/Markdown/JSON export bundle from existing artifacts. |
| Docs generation | `scripts/generate-catalog-docs.mjs` | Rewrites marker-delimited catalog snippets in docs. |

## Runtime Flow

The normal `fdekit run <agent>` path is:

```txt
CLI command
  -> requireConfigFile(cwd)
  -> loadDeployment(fde.config.ts)
  -> createArtifactStore(deployment.artifacts ?? local artifacts/)
  -> runAgent({
       deployment,
       projectDir,
       agentName,
       input,
       strict?,
       providerRegistry: builtinProviderRegistry,
       artifactStore
     })
      -> resolve agent and provider
      -> load instructions
      -> collect connector tools and agent-local tools
      -> collect governance-derived, deployment, and agent policies
      -> resolve runtime edge mode from the explicit strict flag
      -> emit runtime.edge.profile
      -> in strict mode, validate every available tool has argsSchema, scopes, and environments
      -> loop provider.planNextStep()
          -> record provider step event
          -> if final: finish
          -> if tool call:
               enforce runtime edge gates
                 -> tool metadata in strict mode
                 -> tool argsSchema before handler execution
                 -> tool environment limits
               enforce beforeToolCall policies
               run tool handler
               enforce afterToolCall policies
               record tool call event and audit entries
      -> return AgentRunResult with TraceArtifact
  -> write traces/<trace-id>.json through ArtifactStore
```

Provider resolution is intentionally explicit:

1. Use `deployment.providers[agent.provider].runtime` when the config helper supplied one.
2. Otherwise use `providerRegistry[agent.provider]` or `providerRegistry[providerConfig.name]`.
3. Fall back only for the internal mock provider.

This keeps `@fdekit/runtime` independent from OpenAI, Anthropic, Google, Ollama, and future provider packages.

`compileDeployment()` is the inspectable execution-plan stage. It does not run tools, instantiate provider adapters, or create S3 clients; it returns a serializable `CompiledDeploymentPlan` that answers what will run, what runtime adapter source will be used, what policies and tools each agent sees, which harness refs resolve, which env vars are required, which artifact store is configured, and where artifacts will be written.

`fdekit validate` runs the deployment compiler and writes `deployments/execution-plan.json` through the configured artifact store. `fdekit run` executes the deployment directly; use `fdekit validate` or `fdekit validate --strict` before running when a maintainer wants an inspectable plan artifact.

## Runtime Edge Concerns

FDEKit treats cross-cutting safety work as runtime edge behavior. Connectors define capabilities; runtime decides whether a tool call is allowed to cross the boundary into a handler.

The edge concerns are:

| Concern | Runtime Edge Owner |
| --- | --- |
| Tool schemas | `packages/runtime/src/agents/helpers/edge/schema.ts` validates provider-planned args before handler execution. |
| Strict tool metadata | `packages/runtime/src/agents/helpers/edge/tool-gates.ts` checks `argsSchema`, `scopes`, and `environments` in strict mode. |
| Tool semantics | `tool.category` and `tool.tags` describe behavior such as escalation routing or CRM handoff. Evals and macro-evals match these tags instead of connector-specific names. |
| Environment limits | `tool.environments` are enforced by runtime before policies and handlers. |
| Permission scopes | Governance-derived `limitToolScopes()` policies use `ToolCallContext.toolScopes`. |
| Budgets | Governance-derived `limitCost()` policies use `ToolCallContext.costUsd`. |
| Redaction | `redactForGovernance()` is applied before trace and audit persistence. |
| Audit logs | `appendAudit()` writes `audit/audit.jsonl` through `ArtifactStore` unless governance disables audit. |
| Traces | Runtime emits provider, edge, policy, approval, tool, and run events into `TraceArtifact`. |
| Retries and resilience | External HTTP retry/circuit behavior belongs in provider or connector adapters through core resilience helpers, outside the agent loop. |

Strict mode is optional and explicit:

| Entry Point | Standard Mode | Strict Mode |
| --- | --- | --- |
| `fdekit validate` | Missing tool `argsSchema`, `scopes`, or `environments` are warnings. | `fdekit validate --strict` makes missing tool `argsSchema`, `scopes`, or `environments` errors. |
| `runAgent()` | Tool catalog metadata is permissive, but declared schemas and environments are still enforced when present. | `runAgent({ strict: true })` blocks the run before handlers if any available tool misses `argsSchema`, `scopes`, or `environments`. |
| `fdekit run` | Runs with standard runtime edge gates. | `fdekit run <agent> --strict` uses strict runtime edge gates. |

`deployment.environment === 'production'` does not silently enable strict mode. Use the explicit flag so local, staging, and production-shaped pilots all have the same observable switch.

Runtime edge events are part of the trace vocabulary:

| Event | Meaning |
| --- | --- |
| `runtime.edge.profile` | Records whether strict mode and strict metadata requirements were active for the run. |
| `runtime.edge.catalog.validated` | Strict catalog check passed for all available tools. |
| `runtime.edge.catalog.blocked` | Strict catalog check failed before the provider loop entered tool execution. |
| `tool.edge.metadata.blocked` | A selected tool was missing required strict metadata. |
| `tool.schema.blocked` | Provider-planned args did not match the tool schema. |
| `tool.environment.blocked` | The tool is not allowed in the deployment environment. |

## Artifact Lifecycle

Runtime artifacts are written through `ArtifactStore`. The default store is the local `artifacts/` directory. Deployments can opt into S3 by setting `artifacts` in `fde.config.ts`; command output then prints `s3://...` URIs.

```ts
import { defineDeployment } from '@fdekit/core';
import { S3Client, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });

export default defineDeployment({
  name: 'support-triage',
  artifacts: {
    kind: 's3',
    bucket: process.env.FDEKIT_ARTIFACT_BUCKET!,
    prefix: 'teams/support',
    region: process.env.AWS_REGION,
    client: {
      putObject: (input) => s3.send(new PutObjectCommand(input)),
      getObject: (input) => s3.send(new GetObjectCommand(input)),
      listObjectsV2: (input) => s3.send(new ListObjectsV2Command(input)),
    },
  },
  // providers, connectors, agents...
});
```

Runtime does not import the AWS SDK. The S3 store consumes a tiny adapter shape with `putObject`, `getObject`, and `listObjectsV2`, which also keeps MinIO, LocalStack, and wrapped enterprise clients possible.

| Command | Writes | Reads |
| --- | --- | --- |
| `fdekit validate` | `deployments/latest.json`, `deployments/snapshots/deployment-*.json`, `deployments/execution-plan.json` | `fde.config.ts` |
| `fdekit run` | `traces/<trace-id>.json`, `approvals/*.json` when needed, `audit/audit.jsonl` when audit is enabled | `fde.config.ts`, approval files when resuming gated work |
| `fdekit approvals approve/reject` | `approvals/<id>.json`, `audit/audit.jsonl` | existing approval file |
| `fdekit eval run` | `evals/latest.json`, `evals/<eval-id>.json`, optional eval trace files | `fde.config.ts`, datasets referenced by eval definitions |
| `fdekit eval macro` | `evals/macro/latest.json`, `evals/macro/<id>.json`, `evals/macro/report.md` | traces, latest eval artifact |
| `fdekit feedback export` | `feedback/eval-candidates.json`, `feedback/eval-cases.json` | approvals and audit log |
| `fdekit report` | `reports/deployment-report.md` | latest eval and traces |
| `fdekit console` | `console.html`, `consoles/*.html`, `consoles/history.json`, `exports/*` | deployment, traces, latest eval, macro eval, report, approvals, audit log |

Prefer adding runtime artifacts through `writeJsonArtifact()`, `writeTextArtifact()`, `appendJsonlArtifact()`, or the lower-level `ArtifactStore` methods. Use direct `fs.writeFile` for source files, recipe installation files, config cache files, or other local project files that are not runtime evidence.

### Adding An Artifact Store

1. Extend `ArtifactStoreDefinition` in `@fdekit/core` only with serializable configuration fields.
2. Add a runtime implementation behind `packages/runtime/src/artifacts.ts`.
3. Keep SDK clients injected so `@fdekit/runtime` does not gain cloud-provider dependencies.
4. Make `compileDeployment()` return the normalized store and artifact URIs without instantiating clients.
5. Thread the store through runtime entrypoints instead of letting commands or connectors write artifacts directly.
6. Add adapter tests with an in-memory fake client before adding provider-specific examples.

## Adding A Provider

Use this path when the provider should be a package people can import in `fde.config.ts`.

1. Add `packages/providers/<name>` with `package.json`, `tsconfig.json`, `src/index.ts`, `src/interfaces/index.ts`, optional `src/helpers/index.ts`, and tests.
2. Depend only on `@fdekit/core` unless the provider truly needs another runtime-independent dependency.
3. Export a config helper that returns `ProviderConfig` and attaches `runtime: create<Name>Provider`.
4. Export `create<Name>Provider(config, options)` implementing `AgentProvider.planNextStep()`.
5. Parse the model response into `ProviderStep` values. Keep the provider step contract aligned with [Provider Step And Tool Schema Spec](./specs/provider-steps-and-tool-schemas.md).
6. Add the provider to `packages/cli/src/catalog/providers.ts` if it is a built-in CLI scaffold.
7. Add the runtime adapter to `packages/cli/src/providers/registry.ts` only if plain CLI configs should run without importing the provider helper.
8. Add package references and tests for the new package.

Do not import the provider package from `@fdekit/runtime`. Runtime should keep resolving providers through `ProviderConfig.runtime` or `ProviderRuntimeRegistry`.

## Adding A Connector

Use this path when adding a customer-system adapter.

1. Add `packages/connectors/<name>` with `src/index.ts`, `src/interfaces/index.ts`, optional helpers, and tests.
2. Depend on `@fdekit/core` and keep service SDKs optional where possible. For optional runtime libraries, prefer peer dependencies or injected clients.
3. Export `<name>Connector(options)` returning `defineConnector({ name, config, env, tools })`.
4. Define every tool through `defineTool()` and include an args schema for production-facing tools.
5. Add `category` and `tags` for behavior semantics that runtime, evals, docs, or reports may need to understand.
6. Put local/demo behavior behind an explicit local mode. Put live API behavior behind env requirements and resilience helpers when doing HTTP.
7. Add a manifest in the matching `packages/cli/src/catalog/connectors/<domain>.ts` file. Use a new domain file only when the existing shelves are a poor fit.
8. Include scaffold imports, dependencies, env examples, and support notes in the manifest so CLI add, docs, and support matrix stay in sync.
9. Add tests for local mode and mocked API mode.

Do not teach runtime about connector names. Runtime collects tools from deployment connectors, executes by tool name, and infers cross-tool behavior from tool metadata.

## Adding A Recipe

Built-in recipes live in `packages/cli/src/scaffolds/recipes/<recipe>`.

1. Add a recipe folder with `index.ts` plus the smallest helper files needed for checks, docs, and generated assets.
2. Define the install spec with `defineRecipe()` from `packages/cli/src/scaffolds/recipes/spec.ts`; keep file lists, scripts, dependencies, env examples, and validation checks in that typed spec instead of scattering them through command logic.
3. Add the recipe manifest to `packages/cli/src/catalog/recipes.ts`.
4. Set `manifest: requireRecipeManifest('<recipe>')` in the recipe spec.
5. Export the recipe from `packages/cli/src/scaffolds/recipes/index.ts`.
6. Use shared renderers from `packages/cli/src/scaffolds/recipes/config-renderers.ts` for imports, provider choices, runtime settings, eval setup, recipe metadata, and module paths.
7. Add or update CLI recipe tests in `packages/cli/src/__tests__/recipe-commands.test.ts`.

The catalog manifest is the source for docs tables and CLI catalog names. The typed recipe spec is the source for installed project files. Recipe config templates should read as named sections that call shared renderers; add a renderer before copying another provider/settings/eval block.

## Adding A Policy

There are two levels:

- Project-specific policy: use `definePolicy()` in `fde.config.ts`; no package change needed.
- Built-in reusable policy: add the helper to `packages/core/src/policies/index.ts`, export its types if needed, add tests in `packages/core/src/__tests__/policies.test.ts`, then add a CLI shortcut in `packages/cli/src/config/policies.ts` if `fdekit add policy <name>` should know it.

Runtime already collects policies from:

1. deployment governance converted into policies,
2. deployment-level `policies`,
3. agent governance converted into policies,
4. agent-level `policies`.

Policy handlers should return `allow()`, `deny()`, or `requireApproval()` decisions and should use `ToolCallContext` rather than reading runtime globals.

## Adding An Eval

There are three common paths:

- Deployment or agent eval: add `defineEval()` in `fde.config.ts`, with inline cases, a dataset path, assertions, or a custom `run()` function.
- Built-in assertion helper: add it to `packages/core/src/evals/index.ts`, export types if needed, and cover it in `packages/core/src/__tests__/eval-assertions.test.ts`.
- CLI scaffold default eval: update the relevant recipe assets/config renderer or `fdekit add eval` behavior in `packages/cli/src/commands/add.ts`.

`runEvals()` discovers deployment evals and agent evals, runs dataset-backed cases through `runAgent()`, and forwards `providerRegistry` so evals use the same provider adapter path as normal runs.

Macro evals are runtime analysis over existing traces plus the latest eval artifact. Add macro-eval behavior under `packages/runtime/src/macro-evals` when the change is about recurring behavior patterns, not individual assertion checks.

## Adding A Console Section

The console is a reader of artifacts, not a runtime engine.

1. Update `packages/console/src/interfaces/index.ts` only when the console input contract needs a new top-level artifact or option.
2. Prefer deriving display data in `packages/console/src/view-models/index.ts`.
3. Add rendering in a focused file under `packages/console/src/sections` or `packages/console/src/sections/workbench`.
4. Wire the section through `packages/console/src/sections/index.ts` or the relevant parent section.
5. Update `packages/console/src/exports/index.ts` when CSV, Markdown, or JSON exports should include the new data.
6. Update `packages/cli/src/commands/console.ts` only if the CLI must read a new artifact file before calling the console renderer.
7. Add tests in `packages/console/src/__tests__/index.test.ts`.

Keep console sections deterministic and static. Do not fetch live systems, run agents, mutate approvals, or write runtime artifacts from `@fdekit/console`.

## Boundary Guardrails

- Keep public imports at package roots or explicit package exports. Do not document or rely on `dist`, `src`, `helpers`, or `interfaces` subpaths.
- Keep runtime provider-agnostic. Provider-specific imports belong in provider packages or the CLI registry.
- Keep connector-specific API behavior inside connector packages.
- Keep docs snippets marker-delimited and refresh them through `scripts/generate-catalog-docs.mjs`.
- Keep recipe scaffolds recipe-owned. Shared recipe helpers should remove real duplication, not hide recipe-specific behavior.
- Keep tests close to the package whose boundary changed, then run broader repo checks when package references or public types changed.

## Next Step

If you just used the architecture guide to locate a change, read the relevant package README before editing: [`@fdekit/core`](../packages/core/README.md), [`@fdekit/runtime`](../packages/runtime/README.md), [`@fdekit/cli`](../packages/cli/README.md), [`@fdekit/console`](../packages/console/README.md), provider packages, connector packages, or environment packages.
