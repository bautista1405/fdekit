# @fdekit/runtime API Reference

<!-- Maintained via scripts/generate-api-docs.mjs. -->
Run `npm run docs:api` to refresh this page after changing public exports.

Applies to `@fdekit/runtime` v0.5.4.

Declaration source: `packages/runtime/dist/index.d.ts`.

## Stability And Audience

| Stability | Intended audience |
| --- | --- |
| Public, pre-1.0 runtime API | CLI maintainers, automation authors, runtime integrators, and contributors working with artifacts or execution. |

- Import from `@fdekit/runtime` for the full surface, or from exported runtime subpaths such as `@fdekit/runtime/agents`, `@fdekit/runtime/artifacts`, `@fdekit/runtime/config`, `@fdekit/runtime/context`, `@fdekit/runtime/deployments`, `@fdekit/runtime/evals`, `@fdekit/runtime/governance`, `@fdekit/runtime/intelligence`, `@fdekit/runtime/macro-evals`, `@fdekit/runtime/sessions`, `@fdekit/runtime/skills`, and `@fdekit/runtime/traces` for focused automation.
- Some provider runtime contracts are re-exported from `@fdekit/core` so runtime callers can stay on one import surface.

## Top Symbols

| Symbol | Why advanced users reach for it |
| --- | --- |
| [`loadDeployment`](#loaddeployment) | Load and transpile `fde.config.ts`, including environment handling. |
| [`runAgent`](#runagent) | Execute an agent loop and write runtime evidence. |
| [`executeGovernedToolSequence`](#executegovernedtoolsequence) | Execute exact caller-planned tools through runtime policy and resumable approvals without provider re-planning. |
| [`resumeAgentRun`](#resumeagentrun) | Resume a provider run or exact tool sequence from its recorded approved call. |
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
| [`createFileArtifactDeliveryQueue`](#createfileartifactdeliveryqueue) | Commit immutable evidence versions to a restart-safe local spool. |
| [`createHttpArtifactDeliveryTarget`](#createhttpartifactdeliverytarget) | Deliver spooled evidence with protocol and idempotency identity. |
| [`createFileSessionStore`](#createfilesessionstore) | Create the durable append-only local session implementation. |
| [`SessionStore`](#sessionstore) | Storage-neutral append, replay, projection, and snapshot contract. |
| [`SESSION_EVENT_TYPES`](#session-event-types) | Standard event vocabulary for pause, retry, effects, delivery, and lifecycle evidence. |
| [`authorizeRetrieval`](#authorizeretrieval) | Authorize source identities before any content is accessed. |
| [`selectInferenceTarget`](#selectinferencetarget) | Match requirements to decoupled provider/model and endpoint capabilities. |
| [`planStepContext`](#planstepcontext) | Build an allowlisted model context and exclusion manifest under budgets. |
| [`LocalRetrievalIndex`](#localretrievalindex) | Source-aware authorized exact, full-text, vector, and hybrid retrieval. |
| [`LocalMemoryStore`](#localmemorystore) | Scoped working and episodic memory with expiry and source checks. |
| [`LocalKnowledgeStore`](#localknowledgestore) | Provenance-aware entity and relation neighborhood store. |
| [`LocalPolicyAwareCache`](#localpolicyawarecache) | Exact cache partitioned by tenant, policy, target, and source revisions. |
| [`estimateInferenceUsage`](#estimateinferenceusage) | Estimate target cost without inventing unavailable pricing. |
| [`loadProjectSkills`](#loadprojectskills) | Validate local skill manifests and entrypoint integrity without executing them. |
| [`renderReport`](#renderreport) | Render deployment report Markdown. |
| [`renderTraceViewer`](#rendertraceviewer) | Render a static trace viewer. |
| [`createMockProvider`](#createmockprovider) | Credential-free provider adapter for local recipes and tests. |
| [`AgentRunResult`](#agentrunresult) | Result contract returned by `runAgent()`. |
| [`GovernedToolSequenceOptions`](#governedtoolsequenceoptions) | Input contract for deterministic governed tool sequences. |

## Export Count

This page documents 313 public root exports from `@fdekit/runtime`: 135 functions/values and 178 types/interfaces.

## Functions And Values

| Symbol | Kind | Defined in |
| --- | --- | --- |
| <a id="acquiresessionlease"></a>`acquireSessionLease` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="agentrunerror"></a>`AgentRunError` | class | [packages/runtime/src/agents/index.ts](../../packages/runtime/src/agents/index.ts) |
| <a id="allowedexecutionstatetransitions"></a>`allowedExecutionStateTransitions` | function | [packages/runtime/src/sessions/state-machine.ts](../../packages/runtime/src/sessions/state-machine.ts) |
| <a id="appendauditlog"></a>`appendAuditLog` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="appendjsonlartifact"></a>`appendJsonlArtifact` | function | [packages/runtime/src/artifact-store/operations.ts](../../packages/runtime/src/artifact-store/operations.ts) |
| <a id="appendsessioncheckpoint"></a>`appendSessionCheckpoint` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="appendsessioneventwithoutbox"></a>`appendSessionEventWithOutbox` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="approvaldecisionconflicterror"></a>`ApprovalDecisionConflictError` | class | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="approvalfingerprint"></a>`approvalFingerprint` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="approveapproval"></a>`approveApproval` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="artifact-delivery-protocol-version"></a>`ARTIFACT_DELIVERY_PROTOCOL_VERSION` | const | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliveryconflicterror"></a>`ArtifactDeliveryConflictError` | class | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliverycorruptionerror"></a>`ArtifactDeliveryCorruptionError` | class | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliveryid"></a>`artifactDeliveryId` | function | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliveryidempotencyconflicterror"></a>`ArtifactDeliveryIdempotencyConflictError` | class | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliverytransporterror"></a>`ArtifactDeliveryTransportError` | class | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliveryversiongaperror"></a>`ArtifactDeliveryVersionGapError` | class | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactingesterror"></a>`ArtifactIngestError` | class | [packages/runtime/src/artifact-store/http-store.ts](../../packages/runtime/src/artifact-store/http-store.ts) |
| <a id="artifactprotocolerror"></a>`ArtifactProtocolError` | class | [packages/runtime/src/artifact-store/http-store.ts](../../packages/runtime/src/artifact-store/http-store.ts) |
| <a id="ass3artifactclient"></a>`asS3ArtifactClient` | function | [packages/runtime/src/artifact-store/s3-store.ts](../../packages/runtime/src/artifact-store/s3-store.ts) |
| <a id="assertexecutionstatetransition"></a>`assertExecutionStateTransition` | function | [packages/runtime/src/sessions/state-machine.ts](../../packages/runtime/src/sessions/state-machine.ts) |
| <a id="assertsessionlease"></a>`assertSessionLease` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="authorizeretrieval"></a>`authorizeRetrieval` | function | [packages/runtime/src/context/index.ts](../../packages/runtime/src/context/index.ts) |
| <a id="cancelsession"></a>`cancelSession` | function | [packages/runtime/src/sessions/lifecycle.ts](../../packages/runtime/src/sessions/lifecycle.ts) |
| <a id="cantransitionexecutionstate"></a>`canTransitionExecutionState` | function | [packages/runtime/src/sessions/state-machine.ts](../../packages/runtime/src/sessions/state-machine.ts) |
| <a id="chunkdocument"></a>`chunkDocument` | function | [packages/runtime/src/intelligence/local.ts](../../packages/runtime/src/intelligence/local.ts) |
| <a id="collectevals"></a>`collectEvals` | function | [packages/runtime/src/evals/index.ts](../../packages/runtime/src/evals/index.ts) |
| <a id="collectreportpolicynames"></a>`collectReportPolicyNames` | function | [packages/runtime/src/reports.ts](../../packages/runtime/src/reports.ts) |
| <a id="commitexternalaction"></a>`commitExternalAction` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="compiledeployment"></a>`compileDeployment` | function | [packages/runtime/src/deployments/compiler.ts](../../packages/runtime/src/deployments/compiler.ts) |
| <a id="confignotfounderror"></a>`ConfigNotFoundError` | class | [packages/runtime/src/config/index.ts](../../packages/runtime/src/config/index.ts) |
| <a id="createartifactstore"></a>`createArtifactStore` | function | [packages/runtime/src/artifact-store/factory.ts](../../packages/runtime/src/artifact-store/factory.ts) |
| <a id="createartifactstorefromdefinition"></a>`createArtifactStoreFromDefinition` | function | [packages/runtime/src/artifact-store/factory.ts](../../packages/runtime/src/artifact-store/factory.ts) |
| <a id="createdeploymentsnapshot"></a>`createDeploymentSnapshot` | function | [packages/runtime/src/deployments/index.ts](../../packages/runtime/src/deployments/index.ts) |
| <a id="createdevtrace"></a>`createDevTrace` | function | [packages/runtime/src/dev.ts](../../packages/runtime/src/dev.ts) |
| <a id="createdockerexecutionbackend"></a>`createDockerExecutionBackend` | function | [packages/runtime/src/execution/docker-backend.ts](../../packages/runtime/src/execution/docker-backend.ts) |
| <a id="createenvironmentcredentialbroker"></a>`createEnvironmentCredentialBroker` | function | [packages/runtime/src/execution/credential-broker.ts](../../packages/runtime/src/execution/credential-broker.ts) |
| <a id="createfileartifactdeliveryqueue"></a>`createFileArtifactDeliveryQueue` | function | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="createfileartifactstore"></a>`createFileArtifactStore` | function | [packages/runtime/src/artifact-store/local-store.ts](../../packages/runtime/src/artifact-store/local-store.ts) |
| <a id="createfilesessionstore"></a>`createFileSessionStore` | function | [packages/runtime/src/sessions/file-store.ts](../../packages/runtime/src/sessions/file-store.ts) |
| <a id="createfssourcereader"></a>`createFsSourceReader` | function | [packages/runtime/src/grader/index.ts](../../packages/runtime/src/grader/index.ts) |
| <a id="createhttpartifactdeliverytarget"></a>`createHttpArtifactDeliveryTarget` | function | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="createhttpartifactstore"></a>`createHttpArtifactStore` | function | [packages/runtime/src/artifact-store/http-store.ts](../../packages/runtime/src/artifact-store/http-store.ts) |
| <a id="createlocalexecutionbackend"></a>`createLocalExecutionBackend` | function | [packages/runtime/src/execution/local-backend.ts](../../packages/runtime/src/execution/local-backend.ts) |
| <a id="createmockprovider"></a>`createMockProvider` | function | [packages/runtime/src/providers/mock.ts](../../packages/runtime/src/providers/mock.ts) |
| <a id="creates3artifactstore"></a>`createS3ArtifactStore` | function | [packages/runtime/src/artifact-store/s3-store.ts](../../packages/runtime/src/artifact-store/s3-store.ts) |
| <a id="createusageledger"></a>`createUsageLedger` | function | [packages/runtime/src/intelligence/local.ts](../../packages/runtime/src/intelligence/local.ts) |
| <a id="defineexecutiontool"></a>`defineExecutionTool` | function | [packages/runtime/src/execution/tool.ts](../../packages/runtime/src/execution/tool.ts) |
| <a id="diffdeploymentsnapshots"></a>`diffDeploymentSnapshots` | function | [packages/runtime/src/deployments/index.ts](../../packages/runtime/src/deployments/index.ts) |
| <a id="dispatchexternalaction"></a>`dispatchExternalAction` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="enqueuesessionoutbox"></a>`enqueueSessionOutbox` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="estimateinferenceusage"></a>`estimateInferenceUsage` | function | [packages/runtime/src/intelligence/local.ts](../../packages/runtime/src/intelligence/local.ts) |
| <a id="executegovernedtoolsequence"></a>`executeGovernedToolSequence` | function | [packages/runtime/src/agents/index.ts](../../packages/runtime/src/agents/index.ts) |
| <a id="execution-backend-protocol-version"></a>`EXECUTION_BACKEND_PROTOCOL_VERSION` | const | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="expiresession"></a>`expireSession` | function | [packages/runtime/src/sessions/lifecycle.ts](../../packages/runtime/src/sessions/lifecycle.ts) |
| <a id="externalactionconflicterror"></a>`ExternalActionConflictError` | class | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="externalactionreconciliationrequirederror"></a>`ExternalActionReconciliationRequiredError` | class | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="externalactionstateerror"></a>`ExternalActionStateError` | class | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="failexternalaction"></a>`failExternalAction` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="filterevalsbytarget"></a>`filterEvalsByTarget` | function | [packages/runtime/src/evals/index.ts](../../packages/runtime/src/evals/index.ts) |
| <a id="findapproval"></a>`findApproval` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="findconfigfile"></a>`findConfigFile` | function | [packages/runtime/src/config/index.ts](../../packages/runtime/src/config/index.ts) |
| <a id="findprojectdir"></a>`findProjectDir` | function | [packages/runtime/src/config/index.ts](../../packages/runtime/src/config/index.ts) |
| <a id="getcurrentsessionlease"></a>`getCurrentSessionLease` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="http-artifact-default-producer"></a>`HTTP_ARTIFACT_DEFAULT_PRODUCER` | const | [packages/runtime/src/artifact-store/http-store.ts](../../packages/runtime/src/artifact-store/http-store.ts) |
| <a id="http-artifact-protocol-version"></a>`HTTP_ARTIFACT_PROTOCOL_VERSION` | const | [packages/runtime/src/artifact-store/http-store.ts](../../packages/runtime/src/artifact-store/http-store.ts) |
| <a id="invalidexecutionstatetransitionerror"></a>`InvalidExecutionStateTransitionError` | class | [packages/runtime/src/sessions/state-machine.ts](../../packages/runtime/src/sessions/state-machine.ts) |
| <a id="invalidsessioniderror"></a>`InvalidSessionIdError` | class | [packages/runtime/src/sessions/file-store.ts](../../packages/runtime/src/sessions/file-store.ts) |
| <a id="joinnames"></a>`joinNames` | function | [packages/runtime/src/utils.ts](../../packages/runtime/src/utils.ts) |
| <a id="loaddeployment"></a>`loadDeployment` | function | [packages/runtime/src/config/index.ts](../../packages/runtime/src/config/index.ts) |
| <a id="loadprojectskills"></a>`loadProjectSkills` | function | [packages/runtime/src/skills/index.ts](../../packages/runtime/src/skills/index.ts) |
| <a id="localknowledgestore"></a>`LocalKnowledgeStore` | class | [packages/runtime/src/intelligence/local.ts](../../packages/runtime/src/intelligence/local.ts) |
| <a id="localmemorystore"></a>`LocalMemoryStore` | class | [packages/runtime/src/intelligence/local.ts](../../packages/runtime/src/intelligence/local.ts) |
| <a id="localpolicyawarecache"></a>`LocalPolicyAwareCache` | class | [packages/runtime/src/intelligence/local.ts](../../packages/runtime/src/intelligence/local.ts) |
| <a id="localretrievalindex"></a>`LocalRetrievalIndex` | class | [packages/runtime/src/intelligence/local.ts](../../packages/runtime/src/intelligence/local.ts) |
| <a id="markapprovalexecuted"></a>`markApprovalExecuted` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="markexternalactionuncertain"></a>`markExternalActionUncertain` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="marksessionoutboxdelivered"></a>`markSessionOutboxDelivered` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="observeexternalaction"></a>`observeExternalAction` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="parsejsonl"></a>`parseJsonl` | function | [packages/runtime/src/artifact-store/json.ts](../../packages/runtime/src/artifact-store/json.ts) |
| <a id="planstepcontext"></a>`planStepContext` | function | [packages/runtime/src/context/index.ts](../../packages/runtime/src/context/index.ts) |
| <a id="prepareexternalaction"></a>`prepareExternalAction` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="projectsession"></a>`projectSession` | function | [packages/runtime/src/sessions/file-store.ts](../../packages/runtime/src/sessions/file-store.ts) |
| <a id="projectskillloaderror"></a>`ProjectSkillLoadError` | class | [packages/runtime/src/skills/index.ts](../../packages/runtime/src/skills/index.ts) |
| <a id="purgesession"></a>`purgeSession` | function | [packages/runtime/src/sessions/lifecycle.ts](../../packages/runtime/src/sessions/lifecycle.ts) |
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
| <a id="reconcileexternalaction"></a>`reconcileExternalAction` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="recordsessionheartbeat"></a>`recordSessionHeartbeat` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="recordsessioninbox"></a>`recordSessionInbox` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="redactforgovernance"></a>`redactForGovernance` | function | [packages/runtime/src/governance/helpers/index.ts](../../packages/runtime/src/governance/helpers/index.ts) |
| <a id="rejectapproval"></a>`rejectApproval` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="releasesessionlease"></a>`releaseSessionLease` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="rendermacroevalreport"></a>`renderMacroEvalReport` | function | [packages/runtime/src/macro-evals/index.ts](../../packages/runtime/src/macro-evals/index.ts) |
| <a id="renderreport"></a>`renderReport` | function | [packages/runtime/src/reports.ts](../../packages/runtime/src/reports.ts) |
| <a id="rendertraceviewer"></a>`renderTraceViewer` | function | [packages/runtime/src/traces/index.ts](../../packages/runtime/src/traces/index.ts) |
| <a id="renewsessionlease"></a>`renewSessionLease` | function | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="requestapproval"></a>`requestApproval` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="requireconfigfile"></a>`requireConfigFile` | function | [packages/runtime/src/config/index.ts](../../packages/runtime/src/config/index.ts) |
| <a id="reservedelegationbudget"></a>`reserveDelegationBudget` | function | [packages/runtime/src/context/index.ts](../../packages/runtime/src/context/index.ts) |
| <a id="resumeagentrun"></a>`resumeAgentRun` | function | [packages/runtime/src/agents/index.ts](../../packages/runtime/src/agents/index.ts) |
| <a id="revisepausedapproval"></a>`revisePausedApproval` | function | [packages/runtime/src/agents/index.ts](../../packages/runtime/src/agents/index.ts) |
| <a id="runagent"></a>`runAgent` | function | [packages/runtime/src/agents/index.ts](../../packages/runtime/src/agents/index.ts) |
| <a id="rundocumentationskillshadow"></a>`runDocumentationSkillShadow` | function | [packages/runtime/src/skills/documentation-shadow.ts](../../packages/runtime/src/skills/documentation-shadow.ts) |
| <a id="runeval"></a>`runEval` | function | [packages/runtime/src/evals/index.ts](../../packages/runtime/src/evals/index.ts) |
| <a id="runevals"></a>`runEvals` | function | [packages/runtime/src/evals/index.ts](../../packages/runtime/src/evals/index.ts) |
| <a id="rungrader"></a>`runGrader` | function | [packages/runtime/src/grader/index.ts](../../packages/runtime/src/grader/index.ts) |
| <a id="runmacroevals"></a>`runMacroEvals` | function | [packages/runtime/src/macro-evals/index.ts](../../packages/runtime/src/macro-evals/index.ts) |
| <a id="schedulesessionretry"></a>`scheduleSessionRetry` | function | [packages/runtime/src/sessions/lifecycle.ts](../../packages/runtime/src/sessions/lifecycle.ts) |
| <a id="selectinferencetarget"></a>`selectInferenceTarget` | function | [packages/runtime/src/context/index.ts](../../packages/runtime/src/context/index.ts) |
| <a id="session-event-types"></a>`SESSION_EVENT_TYPES` | const | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="session-protocol-version"></a>`SESSION_PROTOCOL_VERSION` | const | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="sessioncorruptionerror"></a>`SessionCorruptionError` | class | [packages/runtime/src/sessions/file-store.ts](../../packages/runtime/src/sessions/file-store.ts) |
| <a id="sessioneventconflicterror"></a>`SessionEventConflictError` | class | [packages/runtime/src/sessions/file-store.ts](../../packages/runtime/src/sessions/file-store.ts) |
| <a id="sessionleaseconflicterror"></a>`SessionLeaseConflictError` | class | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="sessionlocktimeouterror"></a>`SessionLockTimeoutError` | class | [packages/runtime/src/sessions/file-store.ts](../../packages/runtime/src/sessions/file-store.ts) |
| <a id="sessionrevisionconflicterror"></a>`SessionRevisionConflictError` | class | [packages/runtime/src/sessions/file-store.ts](../../packages/runtime/src/sessions/file-store.ts) |
| <a id="sessionsnapshotconflicterror"></a>`SessionSnapshotConflictError` | class | [packages/runtime/src/sessions/file-store.ts](../../packages/runtime/src/sessions/file-store.ts) |
| <a id="sessiontombstonederror"></a>`SessionTombstonedError` | class | [packages/runtime/src/sessions/file-store.ts](../../packages/runtime/src/sessions/file-store.ts) |
| <a id="stalesessionleaseerror"></a>`StaleSessionLeaseError` | class | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="supersedeapproval"></a>`supersedeApproval` | function | [packages/runtime/src/governance/index.ts](../../packages/runtime/src/governance/index.ts) |
| <a id="tombstonesession"></a>`tombstoneSession` | function | [packages/runtime/src/sessions/lifecycle.ts](../../packages/runtime/src/sessions/lifecycle.ts) |
| <a id="validatedeployment"></a>`validateDeployment` | function | [packages/runtime/src/deployments/validation.ts](../../packages/runtime/src/deployments/validation.ts) |
| <a id="verifyfindinglocations"></a>`verifyFindingLocations` | function | [packages/runtime/src/grader/index.ts](../../packages/runtime/src/grader/index.ts) |
| <a id="writejsonartifact"></a>`writeJsonArtifact` | function | [packages/runtime/src/artifact-store/operations.ts](../../packages/runtime/src/artifact-store/operations.ts) |
| <a id="writereviewartifact"></a>`writeReviewArtifact` | function | [packages/runtime/src/grader/index.ts](../../packages/runtime/src/grader/index.ts) |
| <a id="writetextartifact"></a>`writeTextArtifact` | function | [packages/runtime/src/artifact-store/operations.ts](../../packages/runtime/src/artifact-store/operations.ts) |

## Types And Interfaces

| Symbol | Kind | Defined in |
| --- | --- | --- |
| <a id="acquiresessionleaseoptions"></a>`AcquireSessionLeaseOptions` | interface | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="advanceexternalactionoptions"></a>`AdvanceExternalActionOptions` | interface | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="advancesessionleaseoptions"></a>`AdvanceSessionLeaseOptions` | interface | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="agentcontextplanningoptions"></a>`AgentContextPlanningOptions` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="agentprovider"></a>`AgentProvider` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="agentresumeoptions"></a>`AgentResumeOptions` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="agentrunoptions"></a>`AgentRunOptions` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="agentrunresult"></a>`AgentRunResult` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="agentrunstatus"></a>`AgentRunStatus` | type | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="agenttoolcall"></a>`AgentToolCall` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="appendsessioneventbatchresult"></a>`AppendSessionEventBatchResult` | interface | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="appendsessioneventoptions"></a>`AppendSessionEventOptions` | interface | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="appendsessioneventresult"></a>`AppendSessionEventResult` | interface | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="approvalartifact"></a>`ApprovalArtifact` | interface | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="approvaldecisionoptions"></a>`ApprovalDecisionOptions` | interface | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="approvaldecisionrecord"></a>`ApprovalDecisionRecord` | interface | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="approvalrequestinput"></a>`ApprovalRequestInput` | interface | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="approvalstatus"></a>`ApprovalStatus` | type | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="artifactdeliveryack"></a>`ArtifactDeliveryAck` | interface | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliveryattempt"></a>`ArtifactDeliveryAttempt` | interface | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliveryenvelope"></a>`ArtifactDeliveryEnvelope` | interface | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliveryfailure"></a>`ArtifactDeliveryFailure` | interface | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliveryflushresult"></a>`ArtifactDeliveryFlushResult` | interface | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliveryinput"></a>`ArtifactDeliveryInput` | interface | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliveryproducer"></a>`ArtifactDeliveryProducer` | interface | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliveryqueue"></a>`ArtifactDeliveryQueue` | interface | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliveryreceipt"></a>`ArtifactDeliveryReceipt` | interface | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactdeliverytarget"></a>`ArtifactDeliveryTarget` | interface | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="artifactref"></a>`ArtifactRef` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="artifactstore"></a>`ArtifactStore` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="artifactstoredefinitionoptions"></a>`ArtifactStoreDefinitionOptions` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="artifactstorekind"></a>`ArtifactStoreKind` | type | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="auditlogentry"></a>`AuditLogEntry` | interface | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="auditloginput"></a>`AuditLogInput` | interface | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="auditoutcome"></a>`AuditOutcome` | type | [packages/runtime/src/governance/interfaces/index.ts](../../packages/runtime/src/governance/interfaces/index.ts) |
| <a id="authorizeretrievalinput"></a>`AuthorizeRetrievalInput` | interface | [packages/runtime/src/context/index.ts](../../packages/runtime/src/context/index.ts) |
| <a id="budgetevaluation"></a>`BudgetEvaluation` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="cacheentry"></a>`CacheEntry` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="cacheidentity"></a>`CacheIdentity` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="chunkingoptions"></a>`ChunkingOptions` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
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
| <a id="credentialbroker"></a>`CredentialBroker` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="credentiallease"></a>`CredentialLease` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="credentialleaserequest"></a>`CredentialLeaseRequest` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="deliversessionoutboxoptions"></a>`DeliverSessionOutboxOptions` | interface | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="deploymentdiff"></a>`DeploymentDiff` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="deploymentdiffchange"></a>`DeploymentDiffChange` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="deploymentsnapshot"></a>`DeploymentSnapshot` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="deploymentvalidationissue"></a>`DeploymentValidationIssue` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="deploymentvalidationoptions"></a>`DeploymentValidationOptions` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="deploymentvalidationresult"></a>`DeploymentValidationResult` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="deploymentvalidationseverity"></a>`DeploymentValidationSeverity` | type | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="dockerexecutionbackendoptions"></a>`DockerExecutionBackendOptions` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="documentationskilldocument"></a>`DocumentationSkillDocument` | interface | [packages/runtime/src/skills/documentation-shadow.ts](../../packages/runtime/src/skills/documentation-shadow.ts) |
| <a id="documentationskilloutput"></a>`DocumentationSkillOutput` | interface | [packages/runtime/src/skills/documentation-shadow.ts](../../packages/runtime/src/skills/documentation-shadow.ts) |
| <a id="documentationskillshadowresult"></a>`DocumentationSkillShadowResult` | interface | [packages/runtime/src/skills/documentation-shadow.ts](../../packages/runtime/src/skills/documentation-shadow.ts) |
| <a id="environmentcredentialbrokeroptions"></a>`EnvironmentCredentialBrokerOptions` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="estimateinferenceusageinput"></a>`EstimateInferenceUsageInput` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="evalartifact"></a>`EvalArtifact` | interface | [packages/runtime/src/evals/interfaces/index.ts](../../packages/runtime/src/evals/interfaces/index.ts) |
| <a id="evalcaseresult"></a>`EvalCaseResult` | interface | [packages/runtime/src/evals/interfaces/index.ts](../../packages/runtime/src/evals/interfaces/index.ts) |
| <a id="evalsuiteresult"></a>`EvalSuiteResult` | interface | [packages/runtime/src/evals/interfaces/index.ts](../../packages/runtime/src/evals/interfaces/index.ts) |
| <a id="executionbackend"></a>`ExecutionBackend` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="executionbackendcapabilities"></a>`ExecutionBackendCapabilities` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="executioncommand"></a>`ExecutionCommand` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="executioncommandresult"></a>`ExecutionCommandResult` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="executioncommandstatus"></a>`ExecutionCommandStatus` | type | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="executionisolationrequirements"></a>`ExecutionIsolationRequirements` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="executiontool"></a>`ExecutionTool` | type | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="executiontooloptions"></a>`ExecutionToolOptions` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="fileartifactdeliveryqueueoptions"></a>`FileArtifactDeliveryQueueOptions` | interface | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="fileartifactstoreoptions"></a>`FileArtifactStoreOptions` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="filesessionstoreoptions"></a>`FileSessionStoreOptions` | interface | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="governedtoolcall"></a>`GovernedToolCall` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="governedtoolsequenceoptions"></a>`GovernedToolSequenceOptions` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="gradedfindings"></a>`GradedFindings` | interface | [packages/runtime/src/grader/index.ts](../../packages/runtime/src/grader/index.ts) |
| <a id="graderdeps"></a>`GraderDeps` | interface | [packages/runtime/src/grader/index.ts](../../packages/runtime/src/grader/index.ts) |
| <a id="httpartifactdeliverytargetoptions"></a>`HttpArtifactDeliveryTargetOptions` | interface | [packages/runtime/src/artifact-store/delivery.ts](../../packages/runtime/src/artifact-store/delivery.ts) |
| <a id="httpartifactproducer"></a>`HttpArtifactProducer` | interface | [packages/runtime/src/artifact-store/http-store.ts](../../packages/runtime/src/artifact-store/http-store.ts) |
| <a id="httpartifactstoreoptions"></a>`HttpArtifactStoreOptions` | interface | [packages/runtime/src/artifact-store/http-store.ts](../../packages/runtime/src/artifact-store/http-store.ts) |
| <a id="ingestionchunk"></a>`IngestionChunk` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="ingestiondocument"></a>`IngestionDocument` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="knowledgeentity"></a>`KnowledgeEntity` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="knowledgeneighborhood"></a>`KnowledgeNeighborhood` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="knowledgerelation"></a>`KnowledgeRelation` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="knowledgestore"></a>`KnowledgeStore` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="loadedeval"></a>`LoadedEval` | interface | [packages/runtime/src/evals/interfaces/index.ts](../../packages/runtime/src/evals/interfaces/index.ts) |
| <a id="loadedprojectskill"></a>`LoadedProjectSkill` | interface | [packages/runtime/src/skills/index.ts](../../packages/runtime/src/skills/index.ts) |
| <a id="loadprojectskillsoptions"></a>`LoadProjectSkillsOptions` | interface | [packages/runtime/src/skills/index.ts](../../packages/runtime/src/skills/index.ts) |
| <a id="localexecutionbackendoptions"></a>`LocalExecutionBackendOptions` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="macroevalartifact"></a>`MacroEvalArtifact` | interface | [packages/runtime/src/macro-evals/interfaces/index.ts](../../packages/runtime/src/macro-evals/interfaces/index.ts) |
| <a id="macroevalfinding"></a>`MacroEvalFinding` | interface | [packages/runtime/src/macro-evals/interfaces/index.ts](../../packages/runtime/src/macro-evals/interfaces/index.ts) |
| <a id="macroevalpattern"></a>`MacroEvalPattern` | interface | [packages/runtime/src/macro-evals/interfaces/index.ts](../../packages/runtime/src/macro-evals/interfaces/index.ts) |
| <a id="macroevalsuspect"></a>`MacroEvalSuspect` | interface | [packages/runtime/src/macro-evals/interfaces/index.ts](../../packages/runtime/src/macro-evals/interfaces/index.ts) |
| <a id="macroevaltracedocument"></a>`MacroEvalTraceDocument` | interface | [packages/runtime/src/macro-evals/interfaces/index.ts](../../packages/runtime/src/macro-evals/interfaces/index.ts) |
| <a id="memorykind"></a>`MemoryKind` | type | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="memoryquery"></a>`MemoryQuery` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="memoryrecord"></a>`MemoryRecord` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="memoryscope"></a>`MemoryScope` | type | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="memorystore"></a>`MemoryStore` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="mockplanner"></a>`MockPlanner` | type | [packages/runtime/src/providers/mock.ts](../../packages/runtime/src/providers/mock.ts) |
| <a id="mockprovideroptions"></a>`MockProviderOptions` | interface | [packages/runtime/src/providers/mock.ts](../../packages/runtime/src/providers/mock.ts) |
| <a id="observeexternalactionoptions"></a>`ObserveExternalActionOptions` | interface | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="pausedrunartifact"></a>`PausedRunArtifact` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="planstepcontextinput"></a>`PlanStepContextInput` | interface | [packages/runtime/src/context/index.ts](../../packages/runtime/src/context/index.ts) |
| <a id="policyawarecache"></a>`PolicyAwareCache` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="policyviolation"></a>`PolicyViolation` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="prepareexternalactionoptions"></a>`PrepareExternalActionOptions` | interface | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="providerfinalstep"></a>`ProviderFinalStep` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerplancontext"></a>`ProviderPlanContext` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerruntimeadapter"></a>`ProviderRuntimeAdapter` | type | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerruntimefactory"></a>`ProviderRuntimeFactory` | type | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerruntimeregistry"></a>`ProviderRuntimeRegistry` | type | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providerstep"></a>`ProviderStep` | type | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providertoolcallstep"></a>`ProviderToolCallStep` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="providertoolresult"></a>`ProviderToolResult` | interface | [packages/core/src/types/provider.ts](../../packages/core/src/types/provider.ts) |
| <a id="purgesessionoptions"></a>`PurgeSessionOptions` | interface | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="readsessioneventsoptions"></a>`ReadSessionEventsOptions` | interface | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="renewsessionleaseoptions"></a>`RenewSessionLeaseOptions` | interface | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="resolveexternalactionoptions"></a>`ResolveExternalActionOptions` | interface | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="retrievalmode"></a>`RetrievalMode` | type | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="retrievalquery"></a>`RetrievalQuery` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="retrievalresult"></a>`RetrievalResult` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="retrievalstore"></a>`RetrievalStore` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="revisepausedapprovaloptions"></a>`RevisePausedApprovalOptions` | interface | [packages/runtime/src/agents/interfaces/index.ts](../../packages/runtime/src/agents/interfaces/index.ts) |
| <a id="rundocumentationskillshadowoptions"></a>`RunDocumentationSkillShadowOptions` | interface | [packages/runtime/src/skills/documentation-shadow.ts](../../packages/runtime/src/skills/documentation-shadow.ts) |
| <a id="runevalsoptions"></a>`RunEvalsOptions` | interface | [packages/runtime/src/evals/interfaces/index.ts](../../packages/runtime/src/evals/interfaces/index.ts) |
| <a id="runmacroevalsoptions"></a>`RunMacroEvalsOptions` | interface | [packages/runtime/src/macro-evals/interfaces/index.ts](../../packages/runtime/src/macro-evals/interfaces/index.ts) |
| <a id="s3artifactclient"></a>`S3ArtifactClient` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="s3artifactstoreoptions"></a>`S3ArtifactStoreOptions` | interface | [packages/runtime/src/artifact-store/types.ts](../../packages/runtime/src/artifact-store/types.ts) |
| <a id="s3getobjectinput"></a>`S3GetObjectInput` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="s3getobjectoutput"></a>`S3GetObjectOutput` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="s3listobjectsv2input"></a>`S3ListObjectsV2Input` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="s3listobjectsv2output"></a>`S3ListObjectsV2Output` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="s3putobjectinput"></a>`S3PutObjectInput` | interface | [packages/core/src/types/deployment.ts](../../packages/core/src/types/deployment.ts) |
| <a id="schedulesessionretryoptions"></a>`ScheduleSessionRetryOptions` | interface | [packages/runtime/src/sessions/lifecycle.ts](../../packages/runtime/src/sessions/lifecycle.ts) |
| <a id="sessioncheckpointoptions"></a>`SessionCheckpointOptions` | interface | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="sessionevent"></a>`SessionEvent` | interface | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="sessioneventinput"></a>`SessionEventInput` | interface | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="sessioneventtype"></a>`SessionEventType` | type | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="sessionleasetoken"></a>`SessionLeaseToken` | interface | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="sessionlifecycleoptions"></a>`SessionLifecycleOptions` | interface | [packages/runtime/src/sessions/lifecycle.ts](../../packages/runtime/src/sessions/lifecycle.ts) |
| <a id="sessionmessageoptions"></a>`SessionMessageOptions` | interface | [packages/runtime/src/sessions/coordination.ts](../../packages/runtime/src/sessions/coordination.ts) |
| <a id="sessionprojection"></a>`SessionProjection` | interface | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="sessionsnapshot"></a>`SessionSnapshot` | interface | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="sessionstore"></a>`SessionStore` | interface | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="snapshotagent"></a>`SnapshotAgent` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="snapshotconnector"></a>`SnapshotConnector` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="snapshotdeployment"></a>`SnapshotDeployment` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="snapshoteval"></a>`SnapshotEval` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="snapshotgovernance"></a>`SnapshotGovernance` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="snapshotprovider"></a>`SnapshotProvider` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="snapshottool"></a>`SnapshotTool` | interface | [packages/runtime/src/deployments/interfaces/index.ts](../../packages/runtime/src/deployments/interfaces/index.ts) |
| <a id="sourcefile"></a>`SourceFile` | interface | [packages/runtime/src/grader/index.ts](../../packages/runtime/src/grader/index.ts) |
| <a id="sourcereader"></a>`SourceReader` | type | [packages/runtime/src/grader/index.ts](../../packages/runtime/src/grader/index.ts) |
| <a id="standardsessioneventtype"></a>`StandardSessionEventType` | type | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
| <a id="traceartifact"></a>`TraceArtifact` | interface | [packages/runtime/src/traces/interfaces/index.ts](../../packages/runtime/src/traces/interfaces/index.ts) |
| <a id="traceevent"></a>`TraceEvent` | interface | [packages/runtime/src/traces/interfaces/index.ts](../../packages/runtime/src/traces/interfaces/index.ts) |
| <a id="usageledger"></a>`UsageLedger` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="usagesummary"></a>`UsageSummary` | interface | [packages/runtime/src/intelligence/types.ts](../../packages/runtime/src/intelligence/types.ts) |
| <a id="workspacelease"></a>`WorkspaceLease` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="workspaceleaserequest"></a>`WorkspaceLeaseRequest` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="workspaceseedfile"></a>`WorkspaceSeedFile` | interface | [packages/runtime/src/execution/types.ts](../../packages/runtime/src/execution/types.ts) |
| <a id="writesessionsnapshotoptions"></a>`WriteSessionSnapshotOptions` | interface | [packages/runtime/src/sessions/types.ts](../../packages/runtime/src/sessions/types.ts) |
