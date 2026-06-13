# Production Hardening Guide

This guide is for teams moving an FDEKit deployment from a local demo or pilot into a customer-facing production path.

The bar is intentionally strict. A production-shaped agent is not just a model with tools. It is a governed workflow with explicit permissions, failure containment, measurable reliability, audit evidence, and a rollback plan.

## Production Readiness Gate

Do not enable live customer workflows until all of these are true:

| Gate | Required Evidence |
| --- | --- |
| Configuration is validated | `fdekit validate` passes and the latest deployment snapshot is committed or archived. |
| Tool edge metadata is enforced | `fdekit validate --strict` passes, proving every tool declares `argsSchema`, `scopes`, and `environments`. |
| Changes are reviewed | `fdekit diff` has been reviewed for provider, connector, scope, policy, budget, eval, and dataset changes. |
| Evals are release-blocking | `fdekit eval run` and `fdekit eval macro` pass for the critical journey before rollout. |
| Governance is active | Approval gates, permission scopes, budget caps, environment separation, PII handling, secret redaction, and audit logs are configured. |
| Live connector risk is understood | Each API connector has least-privilege credentials, documented scopes, timeouts, retries, circuit breakers, and a rollback path. |
| Write actions are controlled | Slack posts, issue creation, CRM writes, database queries, and customer-specific tools are either read-only or approval-gated. |
| Operators have a runbook | The team knows how to pause the deployment, revoke credentials, replay evidence, export reports, and restore the previous config. |

If any gate fails, keep the deployment in local, staging, shadow, or approval-only mode.

## Security Baseline

### Environments

Use separate deployments for `local`, `development`, `staging`, and `production`.

Production deployments must not reuse local credentials, test workspaces, staging databases, or broad admin tokens. Each connector should declare which environments it can run in, and write tools should be disabled outside the environments where they are explicitly approved.

Recommended defaults:

| Control | Production Requirement |
| --- | --- |
| Provider credentials | Stored in a secret manager or protected environment, never committed. |
| Connector credentials | Least privilege, per environment, rotated on incident or team change. |
| Local mode | Allowed for demos and tests, not treated as production evidence by itself. |
| API mode | Requires live smoke test, owner approval, and scoped credential review. |
| Deployment snapshots | Archived for audit and rollback. |

### Secrets and PII

Production runs should assume prompts, tool inputs, tool outputs, traces, and reports can contain sensitive data.

Required controls:

- Redact secrets before writing traces, reports, dashboard exports, or audit logs.
- Apply PII policies before sending sensitive customer data to external providers.
- Do not place API keys, OAuth tokens, database URLs, session IDs, or customer secrets in agent instructions.
- Keep raw tool responses out of customer-facing reports unless they are explicitly approved and redacted.
- Treat dashboard artifacts as sensitive if they include customer data.

Recommended FDEKit primitives:

- `denyPIILeak()`
- `redactSecrets()`
- environment separation
- audit logs
- approval gates
- tool permission scopes

### Permission Scopes

Every tool should have explicit scopes. Broad tools should be split into narrower tools if the agent only needs a small capability.

Good scopes:

| Tool | Example Scope |
| --- | --- |
| Search codebase | `codebase:read` |
| Read customer profile | `customer:read` |
| Query allowed Postgres tables | `postgres:read` |
| Create issue | `issue:write` |
| Post Slack escalation | `slack:write` |
| Add CRM note | `crm:write` |

Avoid scopes such as `admin`, `all`, `write:*`, or connector credentials that can mutate unrelated customer systems.

### Connector Security

External connectors should fail closed.

Minimum controls:

- Validate tool arguments before execution.
- Use request timeouts.
- Use retry with exponential backoff only for retryable failures. `createHttpReq` honors server `Retry-After` hints on 429/503 responses (capped by `RetryPolicy.maxRetryAfterMs`, default 30s).
- Use circuit breakers to avoid hammering failing services.
- Make write tools idempotent where the downstream API allows it.
- Record a durable audit entry before and after write actions.
- Surface the Slack message, issue, ticket, CRM note, or database evidence in the console.

Postgres requires extra care:

- Default to read-only.
- Restrict schemas and tables.
- Reject mutation statements unless explicitly enabled.
- Enforce query timeouts.
- Enforce row limits.
- Prefer parameterized query helpers over raw SQL.
- Log query shape and result counts, not raw sensitive rows.

## Failure Modes

Production hardening starts by naming how the system can fail.

| Failure Mode | Impact | Required Control |
| --- | --- | --- |
| Wrong tool call | Agent mutates the wrong system or creates noisy customer artifacts. | Tool scopes, approval gates, evals with `expectedToolCall()`, and clear agent instructions. |
| Duplicate write after retry | Slack messages, issues, or CRM notes are created more than once. | Idempotency keys, deduplication metadata, and no retries for non-idempotent writes unless guarded. |
| Provider outage or rate limit | Runs fail, slow down, or produce incomplete work. | Timeouts, retries, circuit breakers, fallback plan, and clear user-facing error states. |
| Connector outage | Agent cannot fetch customer context or complete escalation. | Circuit breaker, partial-result handling, retry budget, and runbook for degraded mode. |
| Prompt injection from customer data | External text instructs the agent to bypass policy or leak data. | Treat tool output as untrusted, constrain tools by scope, keep governance outside the prompt, and test adversarial examples. |
| PII or secret leakage | Sensitive data appears in provider calls, traces, reports, or dashboards. | Redaction, PII policies, output filtering, dashboard access controls, and incident process. |
| Runaway agent loop | Cost and latency spike, or the run never reaches a useful state. | `maxSteps`, latency assertions, budget caps, and provider token limits. |
| Unsafe SQL | Agent reads restricted data or executes expensive queries. | Table allowlists, read-only mode, query validation, timeouts, and row limits. |
| Stale recipe config | Customer deployment drifts from the tested recipe. | `fdekit validate`, `fdekit diff`, versioned migration notes, and snapshot review. |
| Audit artifact loss | Team cannot explain what happened after an incident. | Persist traces, audit logs, approvals, reports, and console exports outside ephemeral storage. |

## SLOs and Release Metrics

SLOs should be set per customer workflow. The table below gives strict defaults for a production pilot.

| Signal | Suggested Pilot Target | Release Blocker |
| --- | --- | --- |
| Critical eval pass rate | 100% for release-blocking evals | Any failed critical eval. |
| Macro-eval regressions | No new high-risk behavior pattern | New unsafe loop, missing approval, or repeated wrong tool call. |
| Critical policy violations | 0 | Any unapproved PII leak, secret leak, budget breach, or environment violation. |
| Approval-gated write accuracy | 100% of writes have approval evidence | Any write without required approval. |
| Run success rate | >= 99% for supported inputs during pilot window | Repeated provider, connector, or validation failures. |
| p95 end-to-end latency | Workflow-specific, usually under 30 seconds for support triage | Latency above agreed customer threshold. |
| p95 cost per run | Under configured budget cap | Any budget cap breach. |
| Tool error rate | Under 1% for live connector calls | Sustained connector errors or circuit breaker open state. |
| Audit completeness | 100% of production runs have trace, audit, policy, and report artifacts | Missing evidence for any production run. |

Dashboard artifacts should make these visible to engineers and stakeholders:

- latest run status,
- eval trend,
- policy violations,
- approval queue,
- cost and latency,
- connector evidence,
- external artifacts,
- report export,
- run history.

## Rollout Strategy

Move in stages. Do not jump from a local recipe to autonomous production writes.

### Stage 0: Local Demo

Use mock providers and local connector modes.

Required before exit:

- recipe installs cleanly,
- `fdekit validate` passes,
- local run produces traces and console,
- evals pass against the bundled dataset.

### Stage 1: Customer Configuration

Point the recipe at customer-owned repos, APIs, schemas, and workspaces, but keep writes disabled or local.

Required before exit:

- customer-specific config is validated,
- connector scopes are reviewed,
- secrets are loaded through environment or secret manager,
- `fdekit diff` shows expected changes only.

### Stage 2: Shadow Mode

Run against real inputs without mutating customer systems.

Required before exit:

- outputs match human expectations,
- evals include customer-like cases,
- no critical policy violations,
- dashboard artifacts are useful enough for review.

### Stage 3: Approval-Gated Pilot

Enable live write tools only behind human approval.

Required before exit:

- every write has approval evidence,
- Slack messages, issues, CRM notes, or database results are visible in the console,
- operators can pause or revoke the deployment,
- rollback has been tested.

### Stage 4: Limited Production

Enable production for a narrow allowlist: specific teams, accounts, channels, repos, tables, or workflows.

Required before expansion:

- SLOs hold for the pilot window,
- incidents and near misses are reviewed,
- budget caps are not breached,
- customer stakeholders accept the report format and audit evidence.

### Stage 5: Expanded Production

Expand only after the workflow is boring, observable, and reversible.

Expansion should require:

- updated eval datasets,
- updated migration notes,
- refreshed support matrix if connector/provider maturity changes,
- production owner sign-off.

## Operational Runbooks

Every production deployment should have a short runbook checked into the customer deployment repo.

Minimum runbook sections:

| Section | What It Must Include |
| --- | --- |
| Pause procedure | How to disable the agent, connector, provider, or write tools immediately. |
| Credential revocation | Where each key/token lives and how to rotate it. |
| Rollback | Which deployment snapshot or git commit is the last known good version. |
| Incident triage | Where to find traces, audit logs, approvals, reports, and dashboard exports. |
| Customer comms | Who gets notified for policy, data, cost, or availability incidents. |
| Live smoke tests | The minimal tests that prove each live connector still works. |
| Vendor drift check | Who owns sandbox smoke runs for API connectors, and when they run them. |

## Production Checklist

Before enabling a production workflow:

- [ ] `fdekit doctor` passes.
- [ ] `fdekit validate --strict` passes.
- [ ] A smoke run with `fdekit run <agent> --strict` passes in the target environment.
- [ ] `fdekit diff` has been reviewed.
- [ ] `fdekit eval run` passes release-blocking evals.
- [ ] `fdekit eval macro` shows no new unsafe behavior patterns.
- [ ] Provider credentials are scoped and protected.
- [ ] Connector credentials are scoped and protected.
- [ ] Sandbox live smoke tests are defined for every API connector used in customer workflows.
- [ ] Write tools are approval-gated or explicitly approved for automation.
- [ ] PII and secret redaction are enabled.
- [ ] Budget caps are configured.
- [ ] `maxSteps`, provider token limits, and timeouts are configured.
- [ ] Postgres connectors are read-only unless mutation is explicitly required and approved.
- [ ] Audit logs, traces, approvals, reports, and exports are retained outside ephemeral storage.
- [ ] The rollback procedure has been tested.
- [ ] The customer-facing report has been reviewed by the deployment owner.

## What Not To Ship

Do not ship production agents that:

- use broad admin credentials,
- write to customer systems without approval evidence,
- rely only on prompt instructions for security,
- lack evals for the critical journey,
- lack policy checks for PII, secrets, environment, cost, and tool scopes,
- store sensitive traces in unmanaged local folders,
- retry non-idempotent writes without deduplication,
- have no rollback path,
- cannot explain what they did after the fact.

The goal is not to make every deployment heavyweight. The goal is to make the risky parts explicit, measured, reversible, and visible.

## Next Step

If you just hardened a deployment, read [Versioning And Migration Notes](./cookbook/versioning-and-migrations.md) to make config changes reviewable with snapshots, diffs, and migration notes. Then compare the setup against the [Production-Shaped Governance-Heavy Reference Architecture](./reference-architectures.md#production-shaped-governance-heavy-setup).
