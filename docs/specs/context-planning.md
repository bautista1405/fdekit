# Policy-Aware Context and Inference Planning

Context planning has three ordered phases. Callers must not retrieve first and
authorize later.

1. `authorizeRetrieval()` evaluates source IDs against the effective policy and
   produces a content-free `RetrievalAuthorizationPlan`.
2. `selectInferenceTarget()` matches task requirements to provider/model
   capabilities and a separate host endpoint reference.
3. `planStepContext()` selects model-visible items, skills, and tool schemas
   under token, retrieval, and tool limits.

## Model boundary

`InferenceTarget` identifies provider, model, capabilities, and optional public
pricing. `InferenceEndpointReference` separately identifies a connection,
region, trust boundary, and secret *reference*. Neither contains a reusable
credential value.

`StepContextPlan.model` is the only provider-visible payload. When
`ProviderPlanContext.contextPlan` is present, the shared provider planner omits
deployment identity, agent identity, raw task input, raw prior tool results,
policy, endpoint, and credential references. It serializes only the allowlisted
`ModelContext`, selected tool schemas, and step counters.

## Budget and evidence

The effective input limit is bounded by both the step budget and target context
window after output and reserved tokens. Required candidates are considered
first, followed by explicit priority and objective score. A required exclusion
makes the plan infeasible.

The `ContextSelectionManifest` records IDs, kinds, token estimates, source IDs,
selection decisions, and exclusion reasons without copying excluded content.
Unknown or unavailable usage is not invented; actual usage is recorded later
through `UsageMeasurement`.
