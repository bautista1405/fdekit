# @fdekit/runtime API Reference

<!-- Maintained via scripts/generate-api-docs.mjs. -->
Run `npm run docs:api` to refresh this page after changing public exports.

Applies to `@fdekit/runtime` v0.1.0.

Declaration source: `packages/runtime/dist/index.d.ts`.

## Stability And Audience

| Stability | Intended audience |
| --- | --- |
| Public, pre-1.0 runtime API | CLI maintainers, automation authors, runtime integrators, and contributors working with artifacts or execution. |

- Import from `@fdekit/runtime` for the full surface, or from exported runtime subpaths such as `@fdekit/runtime/agents`, `@fdekit/runtime/artifacts`, `@fdekit/runtime/config`, `@fdekit/runtime/deployments`, `@fdekit/runtime/evals`, `@fdekit/runtime/governance`, `@fdekit/runtime/macro-evals`, and `@fdekit/runtime/traces` for focused automation.
- Some provider runtime contracts are re-exported from `@fdekit/core` so runtime callers can stay on one import surface.

## Top Symbols

| Symbol | Why advanced users reach for it |
| --- | --- |
| [`loadDeployment`](#loaddeployment) | Load and transpile `fde.config.ts`, including environment handling. |
| [`runAgent`](#runagent) | Execute an agent loop and write runtime evidence. |
| [`validateDeployment`](#validatedeployment) | Validate deployment structure and strict-mode metadata. |
| [`compileDeployment`](#compiledeployment) | Produce the normalized execution plan used by validation and CLI handoff. |
| [`createDeploymentSnapshot`](#createdeploymentsnapshot) | Normalize a deployment into an auditable snapshot. |
| [`diffDeploymentSnapshots`](#diffdeploymentsnapshots) | Compare snapshots and summarize deployment changes. |
| [`runEvals`](#runevals) | Run configured eval suites for a deployment. |
| [`runMacroEvals`](#runmacroevals) | Find recurring behavior patterns across traces and eval artifacts. |
| [`requestApproval`](#requestapproval) | Create or reuse pending approval artifacts. |
| [`approveApproval`](#approveapproval) | Mark an approval artifact as approved. |
| [`appendAuditLog`](#appendauditlog) | Persist an audit-log event through the runtime artifact layer. |
| [`createArtifactStore`](#createartifactstore) | Resolve local or configured artifact storage. |
| [`renderReport`](#renderreport) | Render deployment report Markdown. |
| [`renderTraceViewer`](#rendertraceviewer) | Render a static trace viewer. |
| [`createMockProvider`](#createmockprovider) | Credential-free provider adapter for local recipes and tests. |
| [`AgentRunResult`](#agentrunresult) | Result contract returned by `runAgent()`. |

## Export Count

This page documents 124 public root exports from `@fdekit/runtime`: 46 functions/values and 78 types/interfaces.

## Functions And Values

| Symbol | Kind | Defined in |
| --- | --- | --- |
| <a id="appendauditlog"></a>`appendAuditLog` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="appendjsonlartifact"></a>`appendJsonlArtifact` | function | [packages/runtime/src/artifact-store/operations.ts](../../packages/runtime/src/artifact-store/operations.ts) |
| <a id="approvalfingerprint"></a>`approvalFingerprint` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="approveapproval"></a>`approveApproval` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="ass3artifactclient"></a>`asS3ArtifactClient` | function | [packages/runtime/src/artifact-store/s3-store.ts](../../packages/runtime/src/artifact-store/s3-store.ts) |
| <a id="collectevals"></a>`collectEvals` | function | [packages/runtime/src/evals/index.ts](../../packages/runtime/src/evals/index.ts) |
| <a id="compiledeployment"></a>`compileDeployment` | function | [packages/runtime/src/deployments/compiler.ts](../../packages/runtime/src/deployments/compiler.ts) |
| <a id="confignotfounderror"></a>`ConfigNotFoundError` | class | [packages/runtime/src/config/index.ts](../../packages/runtime/src/config/index.ts) |
| <a id="createartifactstore"></a>`createArtifactStore` | function | [packages/runtime/src/artifact-store/factory.ts](../../packages/runtime/src/artifact-store/factory.ts) |
| <a id="createartifactstorefromdefinition"></a>`createArtifactStoreFromDefinition` | function | [packages/runtime/src/artifact-store/factory.ts](../../packages/runtime/src/artifact-store/factory.ts) |
| <a id="createdeploymentsnapshot"></a>`createDeploymentSnapshot` | function | [packages/runtime/src/deployments/index.ts](../../packages/runtime/src/deployments/index.ts) |
| <a id="createdevtrace"></a>`createDevTrace` | function | [packages/runtime/src/dev.ts](../../packages/runtime/src/dev.ts) |
| <a id="createfileartifactstore"></a>`createFileArtifactStore` | function | [packages/runtime/src/artifact-store/local-store.ts](../../packages/runtime/src/artifact-store/local-store.ts) |
| <a id="createmockprovider"></a>`createMockProvider` | function | [packages/runtime/src/providers/mock.ts](../../packages/runtime/src/providers/mock.ts) |
| <a id="creates3artifactstore"></a>`createS3ArtifactStore` | function | [packages/runtime/src/artifact-store/s3-store.ts](../../packages/runtime/src/artifact-store/s3-store.ts) |
| <a id="diffdeploymentsnapshots"></a>`diffDeploymentSnapshots` | function | [packages/runtime/src/deployments/index.ts](../../packages/runtime/src/deployments/index.ts) |
| <a id="findapproval"></a>`findApproval` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="findconfigfile"></a>`findConfigFile` | function | [packages/runtime/src/config/index.ts](../../packages/runtime/src/config/index.ts) |
| <a id="findprojectdir"></a>`findProjectDir` | function | [packages/runtime/src/config/index.ts](../../packages/runtime/src/config/index.ts) |
| <a id="joinnames"></a>`joinNames` | function | [packages/runtime/src/utils.ts](../../packages/runtime/src/utils.ts) |
| <a id="loaddeployment"></a>`loadDeployment` | function | [packages/runtime/src/config/index.ts](../../packages/runtime/src/config/index.ts) |
| <a id="parsejsonl"></a>`parseJsonl` | function | [packages/runtime/src/artifact-store/json.ts](../../packages/runtime/src/artifact-store/json.ts) |
| <a id="readapproval"></a>`readApproval` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="readapprovals"></a>`readApprovals` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="readauditlog"></a>`readAuditLog` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="readjsonartifact"></a>`readJsonArtifact` | function | [packages/runtime/src/artifact-store/operations.ts](../../packages/runtime/src/artifact-store/operations.ts) |
| <a id="readjsonartifacts"></a>`readJsonArtifacts` | function | [packages/runtime/src/artifact-store/operations.ts](../../packages/runtime/src/artifact-store/operations.ts) |
| <a id="readjsonfile"></a>`readJsonFile` | function | [packages/runtime/src/artifact-store/json.ts](../../packages/runtime/src/artifact-store/json.ts) |
| <a id="readjsonfiles"></a>`readJsonFiles` | function | [packages/runtime/src/artifact-store/json.ts](../../packages/runtime/src/artifact-store/json.ts) |
| <a id="readjsonifexists"></a>`readJsonIfExists` | function | [packages/runtime/src/artifact-store/json.ts](../../packages/runtime/src/artifact-store/json.ts) |
| <a id="readjsonlartifact"></a>`readJsonlArtifact` | function | [packages/runtime/src/artifact-store/operations.ts](../../packages/runtime/src/artifact-store/operations.ts) |
| <a id="readtextartifact"></a>`readTextArtifact` | function | [packages/runtime/src/artifact-store/operations.ts](../../packages/runtime/src/artifact-store/operations.ts) |
| <a id="redactforgovernance"></a>`redactForGovernance` | function | [packages/runtime/src/governance/helpers/index.ts](../../packages/runtime/src/governance/helpers/index.ts) |
| <a id="rejectapproval"></a>`rejectApproval` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="rendermacroevalreport"></a>`renderMacroEvalReport` | function | [packages/runtime/src/macro-evals/index.ts](../../packages/runtime/src/macro-evals/index.ts) |
| <a id="renderreport"></a>`renderReport` | function | [packages/runtime/src/reports.ts](../../packages/runtime/src/reports.ts) |
| <a id="rendertraceviewer"></a>`renderTraceViewer` | function | [packages/runtime/src/traces/index.ts](../../packages/runtime/src/traces/index.ts) |
| <a id="requestapproval"></a>`requestApproval` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="requireconfigfile"></a>`requireConfigFile` | function | [packages/runtime/src/config/index.ts](../../packages/runtime/src/config/index.ts) |
| <a id="runagent"></a>`runAgent` | function | [packages/runtime/src/agents/index.ts](../../packages/runtime/src/agents/index.ts) |
| <a id="runeval"></a>`runEval` | function | [packages/runtime/src/evals/index.ts](../../packages/runtime/src/evals/index.ts) |
| <a id="runevals"></a>`runEvals` | function | [packages/runtime/src/evals/index.ts](../../packages/runtime/src/evals/index.ts) |
| <a id="runmacroevals"></a>`runMacroEvals` | function | [packages/runtime/src/macro-evals/index.ts](../../packages/runtime/src/macro-evals/index.ts) |
| <a id="validatedeployment"></a>`validateDeployment` | function | [packages/runtime/src/deployments/validation.ts](../../packages/runtime/src/deployments/validation.ts) |
| <a id="writejsonartifact"></a>`writeJsonArtifact` | function | [packages/runtime/src/artifact-store/operations.ts](../../packages/runtime/src/artifact-store/operations.ts) |
| <a id="writetextartifact"></a>`writeTextArtifact` | function | [packages/runtime/src/artifact-store/operations.ts](../../packages/runtime/src/artifact-store/operations.ts) |

## Types And Interfaces

| Symbol | Kind | Defined in |
| --- | --- | --- |
| <a id="agentprovider"></a>`AgentProvider` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="agentrunoptions"></a>`AgentRunOptions` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="agentrunresult"></a>`AgentRunResult` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="agentrunstatus"></a>`AgentRunStatus` | type | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="agenttoolcall"></a>`AgentToolCall` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="approvalartifact"></a>`ApprovalArtifact` | interface | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="approvaldecisionoptions"></a>`ApprovalDecisionOptions` | interface | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="approvalrequestinput"></a>`ApprovalRequestInput` | interface | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="approvalstatus"></a>`ApprovalStatus` | type | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="artifactref"></a>`ArtifactRef` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="artifactstore"></a>`ArtifactStore` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="artifactstoredefinitionoptions"></a>`ArtifactStoreDefinitionOptions` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="artifactstorekind"></a>`ArtifactStoreKind` | type | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="auditlogentry"></a>`AuditLogEntry` | interface | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="auditloginput"></a>`AuditLogInput` | interface | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="auditoutcome"></a>`AuditOutcome` | type | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="compiledagentplan"></a>`CompiledAgentPlan` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compiledartifactpaths"></a>`CompiledArtifactPaths` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compiledartifactstoreplan"></a>`CompiledArtifactStorePlan` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compiledconnectorplan"></a>`CompiledConnectorPlan` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compileddeploymentplan"></a>`CompiledDeploymentPlan` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compiledenvrequirement"></a>`CompiledEnvRequirement` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compiledeploymentoptions"></a>`CompileDeploymentOptions` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compiledevalplan"></a>`CompiledEvalPlan` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compiledharnessphaseplan"></a>`CompiledHarnessPhasePlan` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compiledharnessplan"></a>`CompiledHarnessPlan` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compiledplanreference"></a>`CompiledPlanReference` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compiledpolicyplan"></a>`CompiledPolicyPlan` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compiledproviderplan"></a>`CompiledProviderPlan` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compiledproviderruntimeresolution"></a>`CompiledProviderRuntimeResolution` | type | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="compiledtoolplan"></a>`CompiledToolPlan` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="createartifactstoreoptions"></a>`CreateArtifactStoreOptions` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="deploymentdiff"></a>`DeploymentDiff` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="deploymentdiffchange"></a>`DeploymentDiffChange` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="deploymentsnapshot"></a>`DeploymentSnapshot` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="deploymentvalidationissue"></a>`DeploymentValidationIssue` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="deploymentvalidationoptions"></a>`DeploymentValidationOptions` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="deploymentvalidationresult"></a>`DeploymentValidationResult` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="deploymentvalidationseverity"></a>`DeploymentValidationSeverity` | type | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="evalartifact"></a>`EvalArtifact` | interface | [packages/runtime/src/evals/interfaces/index.ts](../../packages/runtime/src/evals/interfaces/index.ts) |
| <a id="evalcaseresult"></a>`EvalCaseResult` | interface | [packages/runtime/src/evals/interfaces/index.ts](../../packages/runtime/src/evals/interfaces/index.ts) |
| <a id="evalsuiteresult"></a>`EvalSuiteResult` | interface | [packages/runtime/src/evals/interfaces/index.ts](../../packages/runtime/src/evals/interfaces/index.ts) |
| <a id="fileartifactstoreoptions"></a>`FileArtifactStoreOptions` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="loadedeval"></a>`LoadedEval` | interface | [packages/runtime/src/evals/interfaces/index.ts](../../packages/runtime/src/evals/interfaces/index.ts) |
| <a id="macroevalartifact"></a>`MacroEvalArtifact` | interface | [packages/runtime/src/macro-evals/interfaces/index.ts](../../packages/runtime/src/macro-evals/interfaces/index.ts) |
| <a id="macroevalfinding"></a>`MacroEvalFinding` | interface | [packages/runtime/src/macro-evals/interfaces/index.ts](../../packages/runtime/src/macro-evals/interfaces/index.ts) |
| <a id="macroevalpattern"></a>`MacroEvalPattern` | interface | [packages/runtime/src/macro-evals/interfaces/index.ts](../../packages/runtime/src/macro-evals/interfaces/index.ts) |
| <a id="macroevalsuspect"></a>`MacroEvalSuspect` | interface | [packages/runtime/src/macro-evals/interfaces/index.ts](../../packages/runtime/src/macro-evals/interfaces/index.ts) |
| <a id="macroevaltracedocument"></a>`MacroEvalTraceDocument` | interface | [packages/runtime/src/macro-evals/interfaces/index.ts](../../packages/runtime/src/macro-evals/interfaces/index.ts) |
| <a id="mockplanner"></a>`MockPlanner` | type | [packages/runtime/src/providers/mock.ts](../../packages/runtime/src/providers/mock.ts) |
| <a id="mockprovideroptions"></a>`MockProviderOptions` | interface | [packages/runtime/src/providers/mock.ts](../../packages/runtime/src/providers/mock.ts) |
| <a id="policyviolation"></a>`PolicyViolation` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="providerfinalstep"></a>`ProviderFinalStep` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerplancontext"></a>`ProviderPlanContext` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerruntimeadapter"></a>`ProviderRuntimeAdapter` | type | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerruntimefactory"></a>`ProviderRuntimeFactory` | type | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerruntimeregistry"></a>`ProviderRuntimeRegistry` | type | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerstep"></a>`ProviderStep` | type | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providertoolcallstep"></a>`ProviderToolCallStep` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providertoolresult"></a>`ProviderToolResult` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="runevalsoptions"></a>`RunEvalsOptions` | interface | [packages/runtime/src/evals/interfaces/index.ts](../../packages/runtime/src/evals/interfaces/index.ts) |
| <a id="runmacroevalsoptions"></a>`RunMacroEvalsOptions` | interface | [packages/runtime/src/macro-evals/interfaces/index.ts](../../packages/runtime/src/macro-evals/interfaces/index.ts) |
| <a id="s3artifactclient"></a>`S3ArtifactClient` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="s3artifactstoreoptions"></a>`S3ArtifactStoreOptions` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="s3getobjectinput"></a>`S3GetObjectInput` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="s3getobjectoutput"></a>`S3GetObjectOutput` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="s3listobjectsv2input"></a>`S3ListObjectsV2Input` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="s3listobjectsv2output"></a>`S3ListObjectsV2Output` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="s3putobjectinput"></a>`S3PutObjectInput` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="snapshotagent"></a>`SnapshotAgent` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="snapshotconnector"></a>`SnapshotConnector` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="snapshotdeployment"></a>`SnapshotDeployment` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="snapshoteval"></a>`SnapshotEval` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="snapshotgovernance"></a>`SnapshotGovernance` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="snapshotprovider"></a>`SnapshotProvider` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="snapshottool"></a>`SnapshotTool` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="traceartifact"></a>`TraceArtifact` | interface | [packages/runtime/src/traces/interfaces/index.ts](../../packages/runtime/src/traces/interfaces/index.ts) |
| <a id="traceevent"></a>`TraceEvent` | interface | [packages/runtime/src/traces/interfaces/index.ts](../../packages/runtime/src/traces/interfaces/index.ts) |
