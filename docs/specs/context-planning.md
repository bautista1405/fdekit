# Policy-Aware Context and Inference Planning

Context planning has three ordered phases. Callers must not retrieve first and
authorize later.

1. `authorizeRetrieval()` evaluates source IDs against the effective policy and
   produces a content-free `RetrievalAuthorizationPlan`.
2. `selectInferenceTarget()` matches task requirements to provider/model
   capabilities and a separate host endpoint reference.
3. `planStepContext()` selects model-visible items, skills, and tool schemas
   under token, retrieval, and tool limits.

`runAgent({ contextPlanning })` executes these phases for every provider step.
It automatically represents the agent instructions, task input, and completed
tool results as required model-context items, while callers supply any
additional evidence, memory, skills, route requirements, and policy.

## Model boundary

`InferenceTarget` identifies provider, model, capabilities, and optional public
pricing. `InferenceEndpointReference` separately identifies a connection,
region, trust boundary, and secret *reference*. Neither contains a reusable
credential value.

`StepContextPlan.model` is the only provider-visible payload. When
`ProviderPlanContext.modelContext` is present, the shared provider planner omits
deployment identity, agent identity, raw task input, raw prior tool results,
policy, endpoint, and credential references. It serializes only the allowlisted
`ModelContext`, selected tool schemas, and step counters.

The runtime resolves the selected endpoint against `DeploymentDefinition.providers`
and overrides its model with the selected target model. Provider adapters in a
planned run receive an empty host envelope plus `modelContext`; they do not
receive the full `StepContextPlan`. Trace/session evidence retains route,
effective-policy, feasibility, and selection IDs without selected content or
credential references.

## Budget and evidence

The effective input limit is bounded by both the step budget and target context
window after output and reserved tokens. Required candidates are considered
first, followed by explicit priority and objective score. A required exclusion
makes the plan infeasible.

Repeated item content is selected once using an explicit `deduplicationKey` or
a deterministic kind/content identity. Callers may also supply a reviewed
`compressed` representation and opt into `when_needed` or `prefer` selection;
the planner never makes a hidden model call to summarize context. The manifest
records duplicate exclusions and compression method/token savings without
copying candidate content.

The `ContextSelectionManifest` records IDs, kinds, token estimates, source IDs,
selection decisions, and exclusion reasons without copying excluded content.
Every provider step records a `UsageMeasurement`. Provider-reported token counts
are `measured`; absent counters produce `unknown` without synthesized token or
cost fields. When the selected `InferenceTarget` declares sufficient pricing,
the runtime adds an estimated cost to the measured record and marks that fact in
metadata. A hard `maxCost` is rejected before inference when target pricing is
missing, fails when provider usage is unavailable, and is checked cumulatively
after every measured response. Normalized input totals include cache reads and
writes; normalized output totals include reasoning. Cache writes require the
optional `cacheWriteInputPerMillionTokens` target rate before a hard cost budget
can accept that measurement.

Tool selection is an execution boundary, not provider guidance: a provider call
to an excluded tool fails before the handler runs. `maxToolCalls` is decremented
across steps; provider latency, run duration, measured tool calls, and cost are
checked after each response. `reserveDelegationBudget()` lets orchestrators
claim a delegation slot before dispatch. Approval and input pauses
persist the exact plan governing the pending call; resume requires a matching
policy fingerprint, target, endpoint, and model.

The per-step output limit is the minimum of the context budget, target
capability, and provider configuration. It is passed to the provider adapter as
`ProviderPlanContext.outputTokenLimit` and enforced in each built-in wire
request.
