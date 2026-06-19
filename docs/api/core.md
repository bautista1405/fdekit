# @fdekit/core API Reference

<!-- Maintained via scripts/generate-api-docs.mjs. -->
Run `npm run docs:api` to refresh this page after changing public exports.

Applies to `@fdekit/core` v0.4.2.

Declaration source: `packages/core/dist/index.d.ts`.

## Stability And Audience

| Stability | Intended audience |
| --- | --- |
| Public, pre-1.0 package-root API | Deployment authors, connector authors, provider authors, and contributors editing config contracts. |

- Import from `@fdekit/core`; subpath imports are internal unless the package exports map grows later.
- This page is built from the declaration entrypoint and should be refreshed after public exports change.

## Top Symbols

| Symbol | Why advanced users reach for it |
| --- | --- |
| [`defineDeployment`](#definedeployment) | Top-level deployment contract for `fde.config.ts` files. |
| [`defineAgent`](#defineagent) | Agent authoring helper for provider, instructions, tool, policy, and eval wiring. |
| [`defineConnector`](#defineconnector) | Connector authoring helper for customer systems and bundled connector packages. |
| [`defineTool`](#definetool) | Tool authoring helper for handlers, scopes, environments, and args schemas. |
| [`objectArgs`](#objectargs) | Schema builder for typed object arguments at the runtime edge. |
| [`stringArg`](#stringarg) | Schema builder for common string inputs inside tool schemas. |
| [`defineEval`](#defineeval) | Eval suite helper for datasets, assertions, and custom runners. |
| [`expectedApprovalOutcome`](#expectedapprovaloutcome) | Built-in eval assertion for reviewed approval decisions. |
| [`expectedToolCall`](#expectedtoolcall) | Built-in eval assertion for required tool usage. |
| [`defineGovernance`](#definegovernance) | Governance helper for approvals, budgets, scopes, audit, and data protection. |
| [`providerFromEnv`](#providerfromenv) | Select the starter provider and optional model from FDEKIT_PROVIDER and FDEKIT_MODEL. |
| [`defineHarness`](#defineharness) | Harness helper for explicit agent-loop phases and review controls. |
| [`DeploymentDefinition`](#deploymentdefinition) | Top-level type behind deployment configs. |
| [`AgentConfig`](#agentconfig) | Agent definition contract consumed by deployments and runtime execution. |
| [`ToolDefinition`](#tooldefinition) | Tool handler contract exposed by connectors. |
| [`ProviderConfig`](#providerconfig) | Provider config contract selected by agents. |
| [`AgentProvider`](#agentprovider) | Provider runtime contract for planning steps. |
| [`createHttpReq`](#createhttpreq) | Shared retry, backoff, and circuit-breaker wrapper for HTTP adapters. |

## Export Count

This page documents 179 public root exports from `@fdekit/core`: 78 functions/values and 101 types/interfaces.

## Functions And Values

| Symbol | Kind | Defined in |
| --- | --- | --- |
| <a id="allow"></a>`allow` | function | [packages/core/src/policies/index.ts](../../packages/core/src/policies/index.ts) |
| <a id="arrayarg"></a>`arrayArg` | function | [packages/core/src/schema/index.ts](../../packages/core/src/schema/index.ts) |
| <a id="asarray"></a>`asArray` | function | [packages/core/src/helpers/index.ts](../../packages/core/src/helpers/index.ts) |
| <a id="asoptionalrecord"></a>`asOptionalRecord` | function | [packages/core/src/helpers/index.ts](../../packages/core/src/helpers/index.ts) |
| <a id="asrecord"></a>`asRecord` | function | [packages/core/src/helpers/index.ts](../../packages/core/src/helpers/index.ts) |
| <a id="asstring"></a>`asString` | function | [packages/core/src/helpers/index.ts](../../packages/core/src/helpers/index.ts) |
| <a id="booleanarg"></a>`booleanArg` | function | [packages/core/src/schema/index.ts](../../packages/core/src/schema/index.ts) |
| <a id="buildproviderplannerinput"></a>`buildProviderPlannerInput` | function | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="buildproviderplannerinputpayload"></a>`buildProviderPlannerInputPayload` | function | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="buildproviderplannerinstructions"></a>`buildProviderPlannerInstructions` | function | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="collectprovidertoolmetadata"></a>`collectProviderToolMetadata` | function | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="compactobject"></a>`compactObject` | function | [packages/core/src/connector-http/index.ts](../../packages/core/src/connector-http/index.ts) |
| <a id="compactrecord"></a>`compactRecord` | function | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="createhttpreq"></a>`createHttpReq` | function | [packages/core/src/resilience/index.ts](../../packages/core/src/resilience/index.ts) |
| <a id="defaultconnectorerrormessage"></a>`defaultConnectorErrorMessage` | function | [packages/core/src/connector-http/index.ts](../../packages/core/src/connector-http/index.ts) |
| <a id="defineagent"></a>`defineAgent` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="defineargsschema"></a>`defineArgsSchema` | function | [packages/core/src/schema/index.ts](../../packages/core/src/schema/index.ts) |
| <a id="defineconnector"></a>`defineConnector` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="definedatalayers"></a>`defineDataLayers` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="definedeployment"></a>`defineDeployment` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="defineenvironment"></a>`defineEnvironment` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="defineeval"></a>`defineEval` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="definegovernance"></a>`defineGovernance` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="defineharness"></a>`defineHarness` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="defineoutcomemetric"></a>`defineOutcomeMetric` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="definepolicy"></a>`definePolicy` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="definerecipe"></a>`defineRecipe` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="definerollout"></a>`defineRollout` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="definetool"></a>`defineTool` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="defineworkflow"></a>`defineWorkflow` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="deny"></a>`deny` | function | [packages/core/src/policies/index.ts](../../packages/core/src/policies/index.ts) |
| <a id="denypiileak"></a>`denyPIILeak` | function | [packages/core/src/policies/index.ts](../../packages/core/src/policies/index.ts) |
| <a id="enumarg"></a>`enumArg` | function | [packages/core/src/schema/index.ts](../../packages/core/src/schema/index.ts) |
| <a id="environmentendpoint"></a>`environmentEndpoint` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="environmentendpointconfigvalue"></a>`environmentEndpointConfigValue` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="escaperegexp"></a>`escapeRegExp` | function | [packages/core/src/helpers/index.ts](../../packages/core/src/helpers/index.ts) |
| <a id="expectedapprovaloutcome"></a>`expectedApprovalOutcome` | function | [packages/core/src/evals/index.ts](../../packages/core/src/evals/index.ts) |
| <a id="expectedfinalanswer"></a>`expectedFinalAnswer` | function | [packages/core/src/evals/index.ts](../../packages/core/src/evals/index.ts) |
| <a id="expectedtoolcall"></a>`expectedToolCall` | function | [packages/core/src/evals/index.ts](../../packages/core/src/evals/index.ts) |
| <a id="extractproviderjson"></a>`extractProviderJson` | function | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="gethttpresilienceoptions"></a>`getHttpResilienceOptions` | function | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="getnumber"></a>`getNumber` | function | [packages/core/src/helpers/index.ts](../../packages/core/src/helpers/index.ts) |
| <a id="getstring"></a>`getString` | function | [packages/core/src/helpers/index.ts](../../packages/core/src/helpers/index.ts) |
| <a id="integerarg"></a>`integerArg` | function | [packages/core/src/schema/index.ts](../../packages/core/src/schema/index.ts) |
| <a id="isdefined"></a>`isDefined` | function | [packages/core/src/helpers/index.ts](../../packages/core/src/helpers/index.ts) |
| <a id="isenvironmentendpointref"></a>`isEnvironmentEndpointRef` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="isnonemptystring"></a>`isNonEmptyString` | function | [packages/core/src/connector-http/index.ts](../../packages/core/src/connector-http/index.ts) |
| <a id="judgerubric"></a>`judgeRubric` | function | [packages/core/src/evals/index.ts](../../packages/core/src/evals/index.ts) |
| <a id="limitcost"></a>`limitCost` | function | [packages/core/src/policies/index.ts](../../packages/core/src/policies/index.ts) |
| <a id="limittoolscopes"></a>`limitToolScopes` | function | [packages/core/src/policies/index.ts](../../packages/core/src/policies/index.ts) |
| <a id="limittooluse"></a>`limitToolUse` | function | [packages/core/src/policies/index.ts](../../packages/core/src/policies/index.ts) |
| <a id="maxcost"></a>`maxCost` | function | [packages/core/src/evals/index.ts](../../packages/core/src/evals/index.ts) |
| <a id="maxlatency"></a>`maxLatency` | function | [packages/core/src/evals/index.ts](../../packages/core/src/evals/index.ts) |
| <a id="mergeenv"></a>`mergeEnv` | function | [packages/core/src/helpers/index.ts](../../packages/core/src/helpers/index.ts) |
| <a id="nopolicyviolation"></a>`noPolicyViolation` | function | [packages/core/src/evals/index.ts](../../packages/core/src/evals/index.ts) |
| <a id="normalizebaseurl"></a>`normalizeBaseUrl` | function | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="notexpectedtoolcall"></a>`notExpectedToolCall` | function | [packages/core/src/evals/index.ts](../../packages/core/src/evals/index.ts) |
| <a id="numberarg"></a>`numberArg` | function | [packages/core/src/schema/index.ts](../../packages/core/src/schema/index.ts) |
| <a id="numberfromenv"></a>`numberFromEnv` | function | [packages/core/src/helpers/index.ts](../../packages/core/src/helpers/index.ts) |
| <a id="objectargs"></a>`objectArgs` | function | [packages/core/src/schema/index.ts](../../packages/core/src/schema/index.ts) |
| <a id="parseenvironmentendpointconfigvalue"></a>`parseEnvironmentEndpointConfigValue` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="parseproviderplannerstep"></a>`parseProviderPlannerStep` | function | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="pick"></a>`pick` | function | [packages/core/src/helpers/index.ts](../../packages/core/src/helpers/index.ts) |
| <a id="providererrormessage"></a>`providerErrorMessage` | function | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="providerfromenv"></a>`providerFromEnv` | function | [packages/core/src/providers/index.ts](../../packages/core/src/providers/index.ts) |
| <a id="readenvvalue"></a>`readEnvValue` | function | [packages/core/src/connector-http/index.ts](../../packages/core/src/connector-http/index.ts) |
| <a id="readprocessenv"></a>`readProcessEnv` | function | [packages/core/src/helpers/index.ts](../../packages/core/src/helpers/index.ts) |
| <a id="redactsecrets"></a>`redactSecrets` | function | [packages/core/src/policies/index.ts](../../packages/core/src/policies/index.ts) |
| <a id="requestconnectorjson"></a>`requestConnectorJson` | function | [packages/core/src/connector-http/index.ts](../../packages/core/src/connector-http/index.ts) |
| <a id="requestproviderjson"></a>`requestProviderJson` | function | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="requireapproval"></a>`requireApproval` | function | [packages/core/src/policies/index.ts](../../packages/core/src/policies/index.ts) |
| <a id="requireenvvalue"></a>`requireEnvValue` | function | [packages/core/src/connector-http/index.ts](../../packages/core/src/connector-http/index.ts) |
| <a id="requireproviderapikey"></a>`requireProviderApiKey` | function | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="resolveenvironmentendpoint"></a>`resolveEnvironmentEndpoint` | function | [packages/core/src/definitions/index.ts](../../packages/core/src/definitions/index.ts) |
| <a id="restrictenvironments"></a>`restrictEnvironments` | function | [packages/core/src/policies/index.ts](../../packages/core/src/policies/index.ts) |
| <a id="restricttables"></a>`restrictTables` | function | [packages/core/src/policies/index.ts](../../packages/core/src/policies/index.ts) |
| <a id="shellescape"></a>`shellEscape` | function | [packages/core/src/helpers/index.ts](../../packages/core/src/helpers/index.ts) |
| <a id="stringarg"></a>`stringArg` | function | [packages/core/src/schema/index.ts](../../packages/core/src/schema/index.ts) |

## Types And Interfaces

| Symbol | Kind | Defined in |
| --- | --- | --- |
| <a id="agentconfig"></a>`AgentConfig` | interface | [packages/core/src/types/agent.ts](../../packages/core/src/types/agent.ts) |
| <a id="agentprovider"></a>`AgentProvider` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="anytooldefinition"></a>`AnyToolDefinition` | type | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="arrayargoptions"></a>`ArrayArgOptions` | interface | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="artifactstoredefinition"></a>`ArtifactStoreDefinition` | type | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="auditlogconfig"></a>`AuditLogConfig` | interface | [packages/core/src/types/governance.ts](../../packages/core/src/types/governance.ts) |
| <a id="booleanargoptions"></a>`BooleanArgOptions` | interface | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="budgetcapdefinition"></a>`BudgetCapDefinition` | interface | [packages/core/src/types/governance.ts](../../packages/core/src/types/governance.ts) |
| <a id="circuitbreakerpolicy"></a>`CircuitBreakerPolicy` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="circuitbreakerstate"></a>`CircuitBreakerState` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="connectordefinition"></a>`ConnectorDefinition` | interface | [packages/core/src/types/connector.ts](../../packages/core/src/types/connector.ts) |
| <a id="connectorjsonrequestoptions"></a>`ConnectorJsonRequestOptions` | interface | [packages/core/src/connector-http/index.ts](../../packages/core/src/connector-http/index.ts) |
| <a id="connectorname"></a>`ConnectorName` | type | [packages/core/src/types/shared.ts](../../packages/core/src/types/shared.ts) |
| <a id="datalayersdefinition"></a>`DataLayersDefinition` | interface | [packages/core/src/types/workflow.ts](../../packages/core/src/types/workflow.ts) |
| <a id="dataprotectionconfig"></a>`DataProtectionConfig` | interface | [packages/core/src/types/governance.ts](../../packages/core/src/types/governance.ts) |
| <a id="deploymentdefinition"></a>`DeploymentDefinition` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="deploymentenvironmentdefinition"></a>`DeploymentEnvironmentDefinition` | interface | [packages/core/src/types/environment.ts](../../packages/core/src/types/environment.ts) |
| <a id="deploymentenvironmentkind"></a>`DeploymentEnvironmentKind` | type | [packages/core/src/types/environment.ts](../../packages/core/src/types/environment.ts) |
| <a id="environmentcheckresult"></a>`EnvironmentCheckResult` | interface | [packages/core/src/types/environment.ts](../../packages/core/src/types/environment.ts) |
| <a id="environmentcommanddefinition"></a>`EnvironmentCommandDefinition` | interface | [packages/core/src/types/environment.ts](../../packages/core/src/types/environment.ts) |
| <a id="environmentendpointdefinition"></a>`EnvironmentEndpointDefinition` | interface | [packages/core/src/types/environment.ts](../../packages/core/src/types/environment.ts) |
| <a id="environmentendpointref"></a>`EnvironmentEndpointRef` | interface | [packages/core/src/types/environment.ts](../../packages/core/src/types/environment.ts) |
| <a id="environmentevidence"></a>`EnvironmentEvidence` | interface | [packages/core/src/types/environment.ts](../../packages/core/src/types/environment.ts) |
| <a id="environmenthealthcheckdefinition"></a>`EnvironmentHealthCheckDefinition` | interface | [packages/core/src/types/environment.ts](../../packages/core/src/types/environment.ts) |
| <a id="environmentname"></a>`EnvironmentName` | type | [packages/core/src/types/shared.ts](../../packages/core/src/types/shared.ts) |
| <a id="environmentprovidername"></a>`EnvironmentProviderName` | type | [packages/core/src/providers/index.ts](../../packages/core/src/providers/index.ts) |
| <a id="environmentseparationconfig"></a>`EnvironmentSeparationConfig` | interface | [packages/core/src/types/governance.ts](../../packages/core/src/types/governance.ts) |
| <a id="environmentservicedefinition"></a>`EnvironmentServiceDefinition` | interface | [packages/core/src/types/environment.ts](../../packages/core/src/types/environment.ts) |
| <a id="environmentvariablerequirement"></a>`EnvironmentVariableRequirement` | interface | [packages/core/src/types/shared.ts](../../packages/core/src/types/shared.ts) |
| <a id="evalassertion"></a>`EvalAssertion` | interface | [packages/core/src/types/eval.ts](../../packages/core/src/types/eval.ts) |
| <a id="evalassertionconfigurationissue"></a>`EvalAssertionConfigurationIssue` | interface | [packages/core/src/types/eval.ts](../../packages/core/src/types/eval.ts) |
| <a id="evalassertionresult"></a>`EvalAssertionResult` | interface | [packages/core/src/types/eval.ts](../../packages/core/src/types/eval.ts) |
| <a id="evalcase"></a>`EvalCase` | interface | [packages/core/src/types/eval.ts](../../packages/core/src/types/eval.ts) |
| <a id="evaldefinition"></a>`EvalDefinition` | interface | [packages/core/src/types/eval.ts](../../packages/core/src/types/eval.ts) |
| <a id="evalruncontext"></a>`EvalRunContext` | interface | [packages/core/src/types/eval.ts](../../packages/core/src/types/eval.ts) |
| <a id="governancedefinition"></a>`GovernanceDefinition` | interface | [packages/core/src/types/governance.ts](../../packages/core/src/types/governance.ts) |
| <a id="harnessdefinition"></a>`HarnessDefinition` | interface | [packages/core/src/types/harness.ts](../../packages/core/src/types/harness.ts) |
| <a id="harnessdefinitioninput"></a>`HarnessDefinitionInput` | interface | [packages/core/src/types/harness.ts](../../packages/core/src/types/harness.ts) |
| <a id="harnessevalref"></a>`HarnessEvalRef` | type | [packages/core/src/types/harness.ts](../../packages/core/src/types/harness.ts) |
| <a id="harnessphasedefinition"></a>`HarnessPhaseDefinition` | interface | [packages/core/src/types/harness.ts](../../packages/core/src/types/harness.ts) |
| <a id="harnessphaseinput"></a>`HarnessPhaseInput` | interface | [packages/core/src/types/harness.ts](../../packages/core/src/types/harness.ts) |
| <a id="harnesspolicyref"></a>`HarnessPolicyRef` | type | [packages/core/src/types/harness.ts](../../packages/core/src/types/harness.ts) |
| <a id="harnessreviewdefinition"></a>`HarnessReviewDefinition` | interface | [packages/core/src/types/harness.ts](../../packages/core/src/types/harness.ts) |
| <a id="harnessreviewinput"></a>`HarnessReviewInput` | interface | [packages/core/src/types/harness.ts](../../packages/core/src/types/harness.ts) |
| <a id="harnesssteerdefinition"></a>`HarnessSteerDefinition` | interface | [packages/core/src/types/harness.ts](../../packages/core/src/types/harness.ts) |
| <a id="harnesssteerinput"></a>`HarnessSteerInput` | interface | [packages/core/src/types/harness.ts](../../packages/core/src/types/harness.ts) |
| <a id="harnesstoolref"></a>`HarnessToolRef` | type | [packages/core/src/types/harness.ts](../../packages/core/src/types/harness.ts) |
| <a id="harnesstriggerref"></a>`HarnessTriggerRef` | type | [packages/core/src/types/harness.ts](../../packages/core/src/types/harness.ts) |
| <a id="httpresilienceclient"></a>`HttpResilienceClient` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="httpresilienceoptions"></a>`HttpResilienceOptions` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="inferschematype"></a>`InferSchemaType` | type | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="jsonschema"></a>`JsonSchema` | interface | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="jsonschematypename"></a>`JsonSchemaTypeName` | type | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="jsonschemavalue"></a>`JsonSchemaValue` | type | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="localartifactstoredefinition"></a>`LocalArtifactStoreDefinition` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="maybepromise"></a>`MaybePromise` | type | [packages/core/src/types/shared.ts](../../packages/core/src/types/shared.ts) |
| <a id="migrationnote"></a>`MigrationNote` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="numberargoptions"></a>`NumberArgOptions` | interface | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="objectargsoptions"></a>`ObjectArgsOptions` | interface | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="outcomemetricdefinition"></a>`OutcomeMetricDefinition` | interface | [packages/core/src/types/workflow.ts](../../packages/core/src/types/workflow.ts) |
| <a id="permissiongrantdefinition"></a>`PermissionGrantDefinition` | interface | [packages/core/src/types/governance.ts](../../packages/core/src/types/governance.ts) |
| <a id="permissionscopedefinition"></a>`PermissionScopeDefinition` | interface | [packages/core/src/types/governance.ts](../../packages/core/src/types/governance.ts) |
| <a id="permissionscopesconfig"></a>`PermissionScopesConfig` | interface | [packages/core/src/types/governance.ts](../../packages/core/src/types/governance.ts) |
| <a id="policydecision"></a>`PolicyDecision` | interface | [packages/core/src/types/policy.ts](../../packages/core/src/types/policy.ts) |
| <a id="policydefinition"></a>`PolicyDefinition` | interface | [packages/core/src/types/policy.ts](../../packages/core/src/types/policy.ts) |
| <a id="policyresult"></a>`PolicyResult` | type | [packages/core/src/types/policy.ts](../../packages/core/src/types/policy.ts) |
| <a id="providerconfig"></a>`ProviderConfig` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerfinalstep"></a>`ProviderFinalStep` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerfromenvoptions"></a>`ProviderFromEnvOptions` | interface | [packages/core/src/providers/index.ts](../../packages/core/src/providers/index.ts) |
| <a id="providerjsonrequestoptions"></a>`ProviderJsonRequestOptions` | interface | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="providername"></a>`ProviderName` | type | [packages/core/src/types/shared.ts](../../packages/core/src/types/shared.ts) |
| <a id="providerplancontext"></a>`ProviderPlanContext` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerplannerinputpayload"></a>`ProviderPlannerInputPayload` | interface | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="providerplannertoolmetadata"></a>`ProviderPlannerToolMetadata` | interface | [packages/core/src/provider-planner/index.ts](../../packages/core/src/provider-planner/index.ts) |
| <a id="providerruntimeadapter"></a>`ProviderRuntimeAdapter` | type | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerruntimefactory"></a>`ProviderRuntimeFactory` | type | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerruntimeregistry"></a>`ProviderRuntimeRegistry` | type | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerstep"></a>`ProviderStep` | type | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providertoolcallstep"></a>`ProviderToolCallStep` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providertoolresult"></a>`ProviderToolResult` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="recipedefinition"></a>`RecipeDefinition` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="recipereference"></a>`RecipeReference` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="retrypolicy"></a>`RetryPolicy` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="rolloutdefinition"></a>`RolloutDefinition` | interface | [packages/core/src/types/workflow.ts](../../packages/core/src/types/workflow.ts) |
| <a id="rolloutstagename"></a>`RolloutStageName` | type | [packages/core/src/types/workflow.ts](../../packages/core/src/types/workflow.ts) |
| <a id="s3artifactclient"></a>`S3ArtifactClient` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="s3artifactstoredefinition"></a>`S3ArtifactStoreDefinition` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="s3getobjectinput"></a>`S3GetObjectInput` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="s3getobjectoutput"></a>`S3GetObjectOutput` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="s3listobjectsv2input"></a>`S3ListObjectsV2Input` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="s3listobjectsv2output"></a>`S3ListObjectsV2Output` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="s3putobjectinput"></a>`S3PutObjectInput` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="stringargoptions"></a>`StringArgOptions` | interface | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="toolargsschema"></a>`ToolArgsSchema` | type | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="toolcallcontext"></a>`ToolCallContext` | interface | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="tooldefinition"></a>`ToolDefinition` | interface | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="tooldefinitionwithschema"></a>`ToolDefinitionWithSchema` | type | [packages/core/src/types/tool.ts](../../packages/core/src/types/tool.ts) |
| <a id="workflowdefinition"></a>`WorkflowDefinition` | interface | [packages/core/src/types/workflow.ts](../../packages/core/src/types/workflow.ts) |
| <a id="workflowscorecarddefinition"></a>`WorkflowScorecardDefinition` | interface | [packages/core/src/types/workflow.ts](../../packages/core/src/types/workflow.ts) |
| <a id="workflowsignalrating"></a>`WorkflowSignalRating` | type | [packages/core/src/types/workflow.ts](../../packages/core/src/types/workflow.ts) |
| <a id="workflowstatedefinition"></a>`WorkflowStateDefinition` | interface | [packages/core/src/types/workflow.ts](../../packages/core/src/types/workflow.ts) |
