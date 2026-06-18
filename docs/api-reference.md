# Public API Reference

This page maps the public TypeScript contracts exported by FDEKit packages.

For "where is this function/type defined?" lookup, use the per-package references:

| Package | Reference | Applies To | Stability / Audience |
| --- | --- | --- | --- |
| `@fdekit/core` | [Core API](./api/core.md) | v0.1.0 | Public, pre-1.0 package-root API for deployment authors, connector authors, provider authors, and contributors editing config contracts. |
| `@fdekit/runtime` | [Runtime API](./api/runtime.md) | v0.1.0 | Public, pre-1.0 runtime API for CLI maintainers, automation authors, runtime integrators, and artifact/execution contributors. |
| `@fdekit/cli` | [CLI API](./api/cli.md) | v0.1.0 | Public, pre-1.0 command surface. The package root has no stable TypeScript import API. |

Refresh the package pages with:

```bash
npm run docs:api
```

FDEKit publishes public entrypoints through each package `exports` map. Import from package roots or explicitly exported subpaths, not from `dist`, `src`, `helpers`, or `interfaces` internals.

```ts
import { defineDeployment, defineAgent } from '@fdekit/core';
import { runAgent, type AgentRunResult } from '@fdekit/runtime';
import { compileDeployment } from '@fdekit/runtime/deployments';
import { githubConnector } from '@fdekit/connector-github';
```

## Package Boundaries

| Package | Use It For | Import Surface |
| --- | --- | --- |
| `@fdekit/core` | Authoring deployments, agents, tools, connectors, policies, evals, recipes, schemas, and provider contracts. | Stable config and authoring primitives. |
| `@fdekit/runtime` | Loading configs, running agents, producing traces/evals/audit artifacts, approvals, reports, and deployment snapshots. | Runtime functions and runtime artifact interfaces. |
| `@fdekit/console` | Rendering the static local dashboard and export bundle. | Console renderer and console data contracts. |
| `@fdekit/provider-*` | Provider config helpers and runtime provider adapters. | Provider factory, runtime adapter, option types. |
| `@fdekit/connector-*` | Connector factory and connector-specific config/tool types. | Connector factory, options, args, result types. |
| `@fdekit/environment-*` | Optional runtime environment packages for local/customer-like stacks. | Environment factory, config, lifecycle commands, health checks, evidence. |
| `@fdekit/cli` | CLI package that installs the `fdekit` binary. | Command interface, not a stable TypeScript import API. |

The practical rule:

- Use `@fdekit/core` inside `fde.config.ts`.
- Use connector and provider packages inside `fde.config.ts`.
- Use `@fdekit/runtime` when building automation around runs, evals, approvals, artifacts, or deployment snapshots.
- Use `@fdekit/console` when rendering dashboard HTML or exports outside the CLI.
- Use environment packages when `fdekit env *` should start, seed, or check a local customer-like runtime.

## Core

Package: `@fdekit/core`

Core is the authoring layer. It should stay free of local filesystem artifact contracts, CLI behavior, and runtime storage details.

### Definition Helpers

| Export | Purpose |
| --- | --- |
| `defineDeployment()` | Define the full deployment config exported from `fde.config.ts`. |
| `defineEnvironment()` | Define a runtime environment for `fdekit env *` commands. |
| `defineAgent()` | Define an agent, its provider, instructions, tools, policies, and evals. |
| `defineTool()` | Define a typed tool handler with optional schema, scopes, environment limits, category, and semantic tags. |
| `defineConnector()` | Define a connector and the tools it exposes. |
| `defineGovernance()` | Define audit, environment, permission, budget, and data-protection settings. |
| `providerFromEnv()` | Select the starter provider and optional model from `FDEKIT_PROVIDER` and `FDEKIT_MODEL`; CLI commands supply the built-in runtime adapters. |
| `defineHarness()` | Define the agent-loop phases and reference the tools, policies, evals, artifacts, review, and steering controls used by each phase. |
| `defineWorkflow()` | Define the customer workflow, current/target state, scorecard, and ownership. |
| `defineOutcomeMetric()` | Define a measurable business or operational outcome for the workflow. |
| `defineDataLayers()` | Define system-of-record, rules, raw intake, and feedback/memory layers. |
| `defineRollout()` | Define the current rollout stage, allowed progression, and next step. |
| `definePolicy()` | Define a custom policy hook. |
| `defineEval()` | Define an eval suite, dataset, inline cases, assertions, or custom runner. |
| `defineRecipe()` | Define reusable recipe metadata and install instructions. |

### Core Types

| Export | Purpose |
| --- | --- |
| `DeploymentDefinition` | Top-level deployment contract. |
| `DeploymentEnvironmentDefinition`, `DeploymentEnvironmentKind` | Runtime environment contract used by `runtimeEnvironment` and `fdekit env *`. |
| `EnvironmentCommandDefinition`, `EnvironmentHealthCheckDefinition`, `EnvironmentCheckResult` | Environment lifecycle command and health-check contracts. |
| `EnvironmentEvidence`, `EnvironmentEndpointDefinition`, `EnvironmentServiceDefinition` | Environment evidence contracts for endpoints, services, replicas, and metadata. |
| `AgentConfig` | Agent config used by deployments and runtime execution. |
| `ProviderConfig` | Provider config selected by agents. |
| `ConnectorDefinition` | Connector contract containing config, env requirements, and tools. |
| `ToolDefinition`, `AnyToolDefinition`, `ToolDefinitionWithSchema` | Tool handler contracts. |
| `ToolCallContext` | Context passed to tool handlers and policy hooks. |
| `GovernanceDefinition` | Governance config for audit, environments, budgets, scopes, and data protection. |
| `HarnessDefinition`, `HarnessDefinitionInput`, `HarnessPhaseDefinition`, `HarnessPhaseInput`, `HarnessReviewDefinition`, `HarnessSteerDefinition` | Agent-loop harness contracts for phases, referenced tools, policies, evals, artifacts, review, and steering. |
| `HarnessToolRef`, `HarnessPolicyRef`, `HarnessEvalRef`, `HarnessTriggerRef` | Harness reference types. Inputs can use primitive objects or names; stored deployments normalize them to names. |
| `WorkflowDefinition`, `WorkflowStateDefinition`, `WorkflowScorecardDefinition` | Field-deployment workflow, current/target state, and workflow scorecard contracts. |
| `OutcomeMetricDefinition` | Outcome metric contract for customer-visible deployment impact. |
| `DataLayersDefinition` | Data-layer contract for system of record, business rules, raw intake, and feedback. |
| `RolloutDefinition`, `RolloutStageName` | Rollout stage and stage progression contracts. |
| `ArtifactStoreDefinition`, `LocalArtifactStoreDefinition`, `S3ArtifactStoreDefinition` | Deployment artifact storage config. Local `.fdekit` is default; S3 requires runtime client injection. |
| `PolicyDefinition`, `PolicyDecision`, `PolicyResult` | Policy contracts and decisions. |
| `EvalDefinition`, `EvalCase`, `EvalAssertion`, `EvalAssertionResult`, `EvalRunContext` | Eval authoring contracts. |
| `RecipeDefinition`, `RecipeReference`, `MigrationNote` | Recipe and migration metadata. |
| `EnvironmentVariableRequirement` | Env var metadata used by doctor/validation/docs. |
| `ProviderName`, `ConnectorName`, `EnvironmentName`, `MaybePromise` | Shared utility types. |
| `ProviderRuntimeAdapter`, `ProviderRuntimeFactory`, `ProviderRuntimeRegistry` | Runtime adapter contracts for config-supplied or caller-supplied provider execution. |

### Tool Args Schema Helpers

FDEKit uses JSON-Schema-shaped helpers for typed tool arguments.

The formal runtime/provider contract is documented in the [provider step and tool schema spec](./specs/provider-steps-and-tool-schemas.md).

| Export | Purpose |
| --- | --- |
| `defineArgsSchema()` | Preserve a manually-authored typed args schema. |
| `objectArgs()` | Build an object args schema with inferred TypeScript shape. |
| `stringArg()` | Build a string property schema. |
| `numberArg()` | Build a number property schema. |
| `integerArg()` | Build an integer property schema. |
| `booleanArg()` | Build a boolean property schema. |
| `enumArg()` | Build an enum property schema. |
| `arrayArg()` | Build an array property schema. |
| `JsonSchema`, `ToolArgsSchema`, `InferSchemaType` | Schema contracts and inference helpers. |
| `StringArgOptions`, `NumberArgOptions`, `BooleanArgOptions`, `ArrayArgOptions`, `ObjectArgsOptions` | Schema option contracts. |

Example:

```ts
import {
  defineConnector,
  defineTool,
  objectArgs,
  stringArg,
  type InferSchemaType,
} from '@fdekit/core';

const createFlagArgs = objectArgs({
  filePath: stringArg({ description: 'Path relative to CODEBASE_ROOT.' }),
  reason: stringArg({ description: 'Why this needs review.' }),
}, {
  required: ['filePath', 'reason'] as const,
});

type CreateFlagArgs = InferSchemaType<typeof createFlagArgs>;

export const codeQuality = defineConnector({
  name: 'code-quality',
  tools: [
    defineTool<CreateFlagArgs>({
      name: 'flag-any-types',
      scopes: ['codebase:write'],
      argsSchema: createFlagArgs,
      handler(args) {
        return { status: 'flagged', ...args };
      },
    }),
  ],
});
```

### Built-In Policy Helpers

| Export | Purpose |
| --- | --- |
| `allow()` | Return an allowed policy decision. |
| `deny()` | Return a denied policy decision. |
| `requireApproval()` | Require human approval before selected tool calls. |
| `denyPIILeak()` | Deny tool inputs/outputs that match PII-like patterns. |
| `redactSecrets()` | Mark secret-like values for redaction in traces/reports. |
| `limitToolUse()` | Limit tool calls by count. |
| `limitCost()` | Limit run cost. |
| `restrictTables()` | Restrict table access from SQL-like tool args. |
| `limitToolScopes()` | Enforce allowed/denied tool permission scopes. |
| `restrictEnvironments()` | Restrict selected tools by deployment environment. |

### Built-In Eval Assertions

| Export | Purpose |
| --- | --- |
| `expectedToolCall()` | Require one or more calls to a tool. |
| `notExpectedToolCall()` | Require zero calls to a tool. |
| `expectedFinalAnswer()` | Match final answer text with a string, regex, or predicate. |
| `judgeRubric()` | Run a custom judge function against a rubric. |
| `maxLatency()` | Require latency under a threshold. |
| `maxCost()` | Require cost under a threshold. |
| `noPolicyViolation()` | Require no policy violations. |

### Provider and Resilience Contracts

| Export | Purpose |
| --- | --- |
| `AgentProvider` | Runtime adapter contract implemented by providers. |
| `ProviderPlanContext` | Context passed to provider `planNextStep()`. |
| `ProviderStep`, `ProviderToolCallStep`, `ProviderFinalStep` | Provider step result contracts. |
| `ProviderToolResult` | Tool result visible to the provider on the next step. |
| `createHttpReq()` | Shared retry/backoff/circuit-breaker wrapper for HTTP adapters. |
| `environmentEndpoint()` | Reference an endpoint exported by the runtime environment; connectors resolve it at tool-call time. |
| `HttpResilienceOptions`, `HttpResilienceClient` | Resilience config and client contracts. |
| `RetryPolicy`, `CircuitBreakerPolicy`, `CircuitBreakerState` | Retry and circuit-breaker contracts. |

## Runtime

Package: `@fdekit/runtime`

Runtime owns execution and artifacts. Runtime-specific interfaces live here rather than in `@fdekit/core` so config authoring stays small and runtime storage can evolve independently.

### Config Loading

| Export | Purpose |
| --- | --- |
| `ConfigNotFoundError` | Error thrown when no `fde.config.ts` can be found. |
| `findConfigFile()` | Search upward for `fde.config.ts`. |
| `requireConfigFile()` | Search upward and throw if missing. |
| `findProjectDir()` | Resolve the project directory from a config search. |
| `loadDeployment()` | Load and transpile `fde.config.ts`, including `.env` loading. |

### Agent Execution

| Export | Purpose |
| --- | --- |
| `runAgent()` | Execute an agent loop against a deployment. |
| `AgentRunOptions` | Input contract for `runAgent()`. |
| `AgentRunResult` | Output contract for a run, including final answer, tools, policies, approvals, cost, latency, and trace. |
| `AgentRunStatus` | `completed`, `failed`, or `waiting_approval`. |
| `AgentToolCall` | Runtime tool-call artifact. |
| `PolicyViolation` | Runtime policy violation artifact. |
| `createDevTrace()` | Create a lightweight development trace from a deployment. |

Provider runtime resolution is explicit. `runAgent()` uses `ProviderConfig.runtime` when the selected provider config supplies one, or `AgentRunOptions.providerRegistry` when a caller wants to keep adapters outside `fde.config.ts`. The CLI supplies its built-in registry for configs using `providerFromEnv()`. Programmatic runtime callers should use provider package helpers or pass a registry themselves; the runtime only has a built-in mock fallback.

Runtime strict mode is also explicit. `runAgent({ strict: true })` requires every available tool to declare `argsSchema`, `scopes`, and `environments`, then validates provider-planned args at the runtime edge before the tool handler executes. Standard runs are permissive about missing metadata, but declared schemas and environments are still enforced.

### Deployment Compilation, Validation, and Snapshots

| Export | Purpose |
| --- | --- |
| `compileDeployment()` | Build a normalized execution plan with resolved providers, tools, policies, harness refs, env requirements, validation issues, and artifact paths. |
| `validateDeployment()` | Validate deployment structure, providers, agents, tools, evals, and governance. `strict: true` makes missing tool `argsSchema`, `scopes`, and `environments` errors. |
| `createDeploymentSnapshot()` | Normalize deployment config into an audit/diff snapshot. |
| `diffDeploymentSnapshots()` | Compare two snapshots and return human-readable changes. |
| `CompileDeploymentOptions`, `CompiledDeploymentPlan`, `CompiledAgentPlan`, `CompiledProviderPlan`, `CompiledConnectorPlan`, `CompiledToolPlan`, `CompiledPolicyPlan`, `CompiledHarnessPlan`, `CompiledEnvRequirement`, `CompiledArtifactStorePlan`, `CompiledArtifactPaths` | Deployment compiler options and execution-plan artifacts. |
| `DeploymentValidationOptions`, `DeploymentValidationResult`, `DeploymentValidationIssue`, `DeploymentValidationSeverity` | Validation options and artifacts. |
| `DeploymentSnapshot`, `SnapshotDeployment`, `SnapshotProvider`, `SnapshotConnector`, `SnapshotTool`, `SnapshotAgent`, `SnapshotGovernance`, `SnapshotArtifactStore`, `SnapshotEval` | Snapshot artifacts. |
| `DeploymentDiff`, `DeploymentDiffChange` | Diff artifacts. |

`fdekit validate` writes this compiler output to `deployments/execution-plan.json` through the configured artifact store so maintainers can inspect what providers, tools, policies, harness references, env vars, and artifact paths the runtime sees before an agent run.

### Evals

| Export | Purpose |
| --- | --- |
| `collectEvals()` | Collect deployment-level and agent-level eval definitions. |
| `runEval()` | Run one eval suite. |
| `runEvals()` | Run all configured eval suites. |
| `LoadedEval` | Runtime wrapper around an eval definition and scope. |
| `EvalCaseResult`, `EvalSuiteResult`, `EvalArtifact` | Eval result artifacts. |
| `RunEvalsOptions` | Input contract for `runEvals()`. |

`RunEvalsOptions.providerRegistry` is forwarded to each agent run so eval automation can use the same explicit provider adapters as `runAgent()`.

### Macro Evals

| Export | Purpose |
| --- | --- |
| `runMacroEvals()` | Analyze traces/eval results for repeated behavior patterns. |
| `renderMacroEvalReport()` | Render a Markdown summary of macro-eval findings. |
| `RunMacroEvalsOptions` | Input contract for macro evals. |
| `MacroEvalArtifact`, `MacroEvalPattern`, `MacroEvalFinding`, `MacroEvalTraceDocument`, `MacroEvalSuspect` | Macro-eval artifacts. |

### Governance Artifacts

| Export | Purpose |
| --- | --- |
| `approvalFingerprint()` | Create a stable fingerprint for an approval request. |
| `requestApproval()` | Write or reuse a pending approval artifact. |
| `findApproval()` | Find an approval by request shape. |
| `readApprovals()` | Read all approval artifacts. |
| `readApproval()` | Read one approval artifact. |
| `approveApproval()` | Mark an approval as approved. |
| `rejectApproval()` | Mark an approval as rejected. |
| `appendAuditLog()` | Append one audit log entry. |
| `readAuditLog()` | Read audit log entries. |
| `redactForGovernance()` | Redact sensitive-looking values before persistence. |
| `ApprovalArtifact`, `ApprovalRequestInput`, `ApprovalDecisionOptions`, `ApprovalStatus` | Approval contracts. |
| `AuditLogEntry`, `AuditLogInput`, `AuditOutcome` | Audit contracts. |

### Traces, Reports, and Artifacts

| Export | Purpose |
| --- | --- |
| `TraceArtifact`, `TraceEvent` | Trace contracts. |
| `renderTraceViewer()` | Render simple static trace viewer HTML. |
| `renderReport()` | Render Markdown deployment report content. |
| `ArtifactStore`, `ArtifactStoreKind`, `ArtifactRef` | Runtime artifact store contract and refs. |
| `createArtifactStore()` | Resolve a caller-supplied store, deployment `artifacts` config, or default local `.fdekit` store. |
| `createArtifactStoreFromDefinition()` | Create a store from an explicit `ArtifactStoreDefinition`. |
| `createFileArtifactStore()` | Create the local filesystem artifact store. |
| `createS3ArtifactStore()` | Create an S3 artifact store from a bucket, prefix, and adapter client. |
| `S3ArtifactClient`, `S3PutObjectInput`, `S3GetObjectInput`, `S3GetObjectOutput`, `S3ListObjectsV2Input`, `S3ListObjectsV2Output` | Minimal S3 adapter contracts used to avoid a runtime AWS SDK dependency. |
| `writeJsonArtifact()` | Write a JSON artifact through the configured store. |
| `writeTextArtifact()` | Write a text artifact through the configured store. |
| `appendJsonlArtifact()` | Append one JSONL entry through the configured store. |
| `readJsonArtifact()` | Read one JSON artifact from the configured store. |
| `readJsonArtifacts()` | Read sorted JSON artifacts from one store group. |
| `readTextArtifact()` | Read one text artifact from the configured store. |
| `readJsonlArtifact()` | Read JSONL entries from the configured store. |
| `readJsonFiles()` | Compatibility helper for reading sorted local JSON files from a directory. |
| `readJsonIfExists()` | Compatibility helper for reading optional local JSON safely. |
| `joinNames()` | Format a list of names for reports. |

S3 support is configurable from `fde.config.ts` without adding AWS SDK dependencies to `@fdekit/runtime`:

```ts
artifacts: {
  kind: 's3',
  bucket: process.env.FDEKIT_ARTIFACT_BUCKET!,
  prefix: 'teams/support',
  client: {
    putObject: (input) => s3.send(new PutObjectCommand(input)),
    getObject: (input) => s3.send(new GetObjectCommand(input)),
    listObjectsV2: (input) => s3.send(new ListObjectsV2Command(input)),
  },
}
```

### Provider Runtime Contracts

`@fdekit/runtime` exports provider runtime types and the built-in mock adapter:

| Export | Purpose |
| --- | --- |
| `createMockProvider()` | Create the credential-free mock runtime adapter used by local recipes and tests. |
| `ProviderRuntimeAdapter` | Either an `AgentProvider` instance or a factory that creates one from `ProviderConfig`. |
| `ProviderRuntimeFactory` | Function contract for creating an `AgentProvider` from `ProviderConfig`. |
| `ProviderRuntimeRegistry` | Map of provider names to runtime adapters/factories passed to `runAgent()` or `runEvals()`. |

## Providers

Provider packages export two kinds of functions:

- config helpers used in `fde.config.ts`,
- runtime adapters used by the agent loop.

Provider config helpers attach their runtime adapter through `ProviderConfig.runtime`, so importing `openaiProvider()` or `localOllamaProvider()` in config is enough for `@fdekit/runtime` to execute that provider. Callers can also keep adapters out of config and pass a `ProviderRuntimeRegistry` explicitly.

The OpenAI, Anthropic, and Google providers also accept an injected official SDK client (`client` option, e.g. `anthropicProvider({ client: new Anthropic() })`). The injected client replaces FDEKit's raw HTTP path and owns auth, retries, and timeouts; the API key env var is then optional. The SDKs are optional peer dependencies.

| Package | Config Exports | Runtime Exports | Types |
| --- | --- | --- | --- |
| `@fdekit/provider-mock` | none; use `{ name: 'mock' }` in config | `createMockProvider()` | Uses core `AgentProvider`. |
| `@fdekit/provider-openai` | `openaiProvider()` | `createOpenAIProvider()` | `OpenAIProviderOptions`, `OpenAIRuntimeOptions`, `OpenAIResponsesClient` |
| `@fdekit/provider-anthropic` | `anthropicProvider()` | `createAnthropicProvider()` | `AnthropicProviderOptions`, `AnthropicRuntimeOptions`, `AnthropicMessagesClient` |
| `@fdekit/provider-google` | `googleProvider()`, `geminiProvider` | `createGoogleProvider()` | `GoogleProviderOptions`, `GoogleRuntimeOptions`, `GoogleGenAIClient` |
| `@fdekit/provider-ollama` | `localOllamaProvider()`, `ollamaProvider()` | `createOllamaProvider()` | `OllamaProviderOptions`, `OllamaRuntimeOptions` |

## Connectors

Connector packages export a connector factory plus connector-specific config, options, args, and result types.

| Package | Factory | Tool Names | Exported Type Families |
| --- | --- | --- | --- |
| `@fdekit/connector-codebase` | `codebaseConnector()` | `codebase.listFiles`, `codebase.search`, `codebase.readFile` | `CodebaseConnectorConfig`, `CodebaseConnectorOptions`, `CodebaseListFilesArgs`, `CodebaseSearchArgs`, `CodebaseReadFileArgs`, `CodebaseFileEntry`, `CodebaseSearchMatch`, `CodebaseReadFileResult` |
| `@fdekit/connector-customer-api` | `customerApiConnector()` | `customerApi.healthCheck`, `customer.get`, `ticket.get`, `ticket.escalate` | `CustomerApiConnectorConfig`, `CustomerApiConnectorOptions`, `CustomerApiHealthCheckArgs`, `CustomerApiHealthCheckResult`, `CustomerApiMapper`, `CustomerApiRoutes`, `GetCustomerArgs`, `GetTicketArgs`, `EscalateTicketArgs` |
| `@fdekit/connector-github` | `githubConnector()` | `issue.create` | `GitHubConnectorConfig`, `GitHubConnectorMode`, `GitHubConnectorOptions`, `CreateIssueArgs`, `CreateIssueResult` |
| `@fdekit/connector-slack` | `slackConnector()` | `slack.message` | `SlackConnectorConfig`, `SlackConnectorMode`, `SlackConnectorOptions`, `SlackMessageArgs`, `SlackMessageResult` |
| `@fdekit/connector-postgres` | `postgresConnector()` | `postgres.healthCheck`, `postgres.listTables`, `postgres.describeTable`, `postgres.query` | `PostgresConnectorConfig`, `PostgresConnectorMode`, `PostgresConnectorOptions`, `PostgresQueryArgs`, `PostgresQueryResult`, `PostgresQueryClient`, `PostgresQueryInput`, `PostgresDriverResult`, `PostgresPoolOptions`, `PostgresHealthCheckArgs`, `PostgresHealthCheckResult`, `PostgresListTablesArgs`, `PostgresListTablesResult`, `PostgresTableSummary`, `PostgresDescribeTableArgs`, `PostgresDescribeTableResult`, `PostgresColumnSummary`, `SqlStatementKind` |
| `@fdekit/connector-k6` | `k6Connector()` | `loadtest.run` | `K6ConnectorConfig`, `K6ConnectorMode`, `K6ConnectorOptions`, `K6RunArgs`, `K6RunResult`, `K6Scenario`, `K6CommandInvocation`, `K6CommandResult` |
| `@fdekit/connector-jira` | `jiraConnector()` | `jira.issue.create`, `issue.create` | `JiraConnectorConfig`, `JiraConnectorMode`, `JiraConnectorOptions`, `CreateJiraIssueArgs`, `CreateJiraIssueResult` |
| `@fdekit/connector-linear` | `linearConnector()` | `linear.issue.create`, `issue.create` | `LinearConnectorConfig`, `LinearConnectorMode`, `LinearConnectorOptions`, `CreateLinearIssueArgs`, `CreateLinearIssueResult` |
| `@fdekit/connector-hubspot` | `hubspotConnector()` | `hubspot.note.create`, `crm.note.create` | `HubSpotConnectorConfig`, `HubSpotConnectorMode`, `HubSpotConnectorOptions`, `HubSpotAssociation`, `HubSpotAssociationType`, `CreateHubSpotNoteArgs`, `CreateHubSpotNoteResult` |
| `@fdekit/connector-salesforce` | `salesforceConnector()` | `salesforce.task.create`, `crm.note.create` | `SalesforceConnectorConfig`, `SalesforceConnectorMode`, `SalesforceConnectorOptions`, `CreateSalesforceTaskArgs`, `CreateSalesforceTaskResult` |

Common tool names such as `issue.create` and `crm.note.create` are the easy rung. Native tool names such as `jira.issue.create`, `linear.issue.create`, `hubspot.note.create`, and `salesforce.task.create` remain available when a recipe needs provider-specific behavior.

## Environments

Environment packages are not connectors. They describe and operate the runtime environment around the customer API. Agent runs still talk to connectors such as `customerApiConnector({ baseUrl: process.env.CUSTOMER_API_URL })`.

| Package | Factory | Kind | Purpose |
| --- | --- | --- | --- |
| `@fdekit/environment-docker` | `dockerEnvironment()` | `local-docker` | Start/describe/seed/check a local Docker Compose customer stack plus customer API evidence. |
| `@fdekit/environment-floci` | `flociEnvironment()` | `local-floci` | Start/describe/seed/check AWS, Azure, or GCP Floci emulators plus customer API evidence. |

`fdekit env *` reads `runtimeEnvironment` first, then `localEnvironment` for compatibility.

`flociEnvironment({ cloud })` maps each cloud to its emulator defaults: AWS uses `floci/floci:latest` on `4566`, Azure uses `floci/floci-az:latest` on `4577`, and GCP uses `floci/floci-gcp:latest` on `4588`. Environment command env is also cloud-specific, so customer API start/seed commands receive AWS endpoint vars, Azure storage connection strings, or GCP emulator host vars as appropriate.

## Console

Package: `@fdekit/console`

| Export | Purpose |
| --- | --- |
| `renderConsole()` | Render the overview dashboard HTML from `ConsoleData`. |
| `renderConsolePages()` | Render the static multi-page dashboard bundle from `ConsoleData`. |
| `createConsoleExportBundle()` | Create CSV, Markdown, and JSON export contents from `ConsoleData`. |
| `ConsoleData` | Dashboard input contract. |
| `ConsoleHistoryEntry` | Console history entry contract. |
| `ConsoleExportBundle` | Export bundle contract. |
| `ConsolePage` | Static dashboard page contract. |

## CLI

Package: `@fdekit/cli`

The CLI is the user-facing command surface. It is intentionally not documented as a TypeScript import API.

Main commands:

| Command | Purpose |
| --- | --- |
| `fdekit init` | Scaffold a new FDEKit project. |
| `fdekit recipe install <name>` | Install a recipe such as `support-triage`, `codebase-agent`, `sales-research-agent`, or `load-test-agent`. |
| `fdekit recipe install <path>` | Install a captured local recipe from a filesystem path. |
| `fdekit recipe capture <name>` | Capture the current deployment as a reusable local recipe under `recipes/<name>/`. |
| `fdekit add provider` | Add provider config and env docs. |
| `fdekit add connector` | Add connector config and env docs. |
| `fdekit doctor` | Check local project readiness. |
| `fdekit env start` | Run configured environment start commands. |
| `fdekit env seed` | Run configured environment seed commands. |
| `fdekit env doctor` | Run configured environment health checks. |
| `fdekit env stop` | Run configured environment stop commands. |
| `fdekit env describe` | Print configured environment endpoints, services, and commands. |
| `fdekit validate [--strict]` | Validate config and write deployment snapshots. `--strict` requires every tool to declare `argsSchema`, `scopes`, and `environments`. |
| `fdekit diff` | Compare deployment snapshots/config changes. |
| `fdekit dev` | Generate local dev trace artifacts. |
| `fdekit run <agent> [--strict]` | Run an agent loop. `--strict` activates runtime edge gates for tool metadata before handlers execute. |
| `fdekit eval run` | Run configured evals. |
| `fdekit eval macro` | Run macro evals over traces/eval artifacts. |
| `fdekit report` | Generate a Markdown deployment report. |
| `fdekit console` | Generate the static dashboard and exports. |
| `fdekit approvals` | Inspect and decide pending approvals. |
| `fdekit feedback export` | Export approvals and audit decisions into eval-candidate artifacts. |

## Stability Notes

Public imports should come from package roots or explicit package exports:

```ts
import { defineTool } from '@fdekit/core';
import { runEvals } from '@fdekit/runtime';
import { runAgent } from '@fdekit/runtime/agents';
import { postgresConnector } from '@fdekit/connector-postgres';
```

Avoid unexported implementation imports:

```ts
// Avoid this. Helpers are internal implementation details unless explicitly exported later.
import { validateSql } from '@fdekit/connector-postgres/dist/helpers/index.js';
```

As the project approaches 1.0, this page should become the contract checklist for semver decisions: changes to this document are public API changes.

## Next Step

If you just found the symbol or package boundary you needed, use the package onboarding README for the layer you are changing: [`@fdekit/core`](../packages/core/README.md), [`@fdekit/runtime`](../packages/runtime/README.md), [`@fdekit/cli`](../packages/cli/README.md), providers, connectors, environments, or console. For implementation boundaries, continue to [Maintainer Architecture](./architecture.md).
