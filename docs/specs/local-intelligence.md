# Local Intelligence Primitives

`@fdekit/runtime/intelligence` supplies small deterministic Community
implementations behind interfaces that commercial services can replace. These
implementations are in-process; durable session and artifact storage remain
separate concerns.

## Ingestion and retrieval

`LocalRetrievalIndex` chunks immutable `SourceSnapshot` documents with stable
content IDs. Replacing a source removes its prior revision before indexing the
new one. Search supports:

- exact substring matching;
- deterministic full-text term coverage;
- cosine search over caller-supplied embeddings;
- weighted lexical/vector hybrid search;
- exact structured metadata filters.

Every search requires a successful `RetrievalAuthorizationPlan`, and results
are restricted to its allowed source IDs. FDEKit never invokes an embedding
model implicitly; callers provide embeddings and account for that inference.

## Memory and knowledge

`LocalMemoryStore` keeps working and episodic records distinct and scopes them
to a user, agent, session, or organization. Expiry and source authorization are
checked on reads.

`LocalKnowledgeStore` is separate. Entities and relations retain immutable
source snapshots, provenance, confidence, and observed/inferred/human-confirmed
state. Neighborhood queries filter both nodes and relations through the same
source authorization.

## Cache and cost

`LocalPolicyAwareCache` uses exact identities containing tenant, policy, target,
and source revisions. It has no cross-tenant or semantic fallback. Source
revision invalidation removes stale entries.

`estimateInferenceUsage()` uses declared `InferenceTarget` pricing and returns
`unknown` when pricing is incomplete. `UsageLedger` preserves measured,
estimated, and unknown counts and evaluates token, tool, latency, cost, and
currency constraints without manufacturing missing usage.
