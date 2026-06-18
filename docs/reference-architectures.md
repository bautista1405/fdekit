# Reference Architectures

Use these as starting shapes when you need to explain or choose a deployment posture. They are intentionally small enough to copy into a customer deployment plan.

## Local Deterministic Demo

Use this when the goal is to prove the FDEKit loop in 30 minutes without credentials or external systems.

| Layer | Choice |
| --- | --- |
| Provider | `mock` provider |
| Connectors | Local-mode connectors such as `customerApiConnector()`, `slackConnector({ mode: 'local' })`, `githubConnector({ mode: 'local' })`, or `k6Connector({ mode: 'local' })` |
| Environment | Local sample API or no runtime environment |
| Artifacts | Default local `artifacts/` directory |
| Governance | Basic policies, local approvals, audit log, evals, macro evals, report, console |

Recommended path:

```bash
npm install
npm run demo
```

This architecture is best for onboarding, demos, contributor tests, and recipe authoring. It should show the complete evidence loop: trace, tool calls, policy checks, eval status, macro patterns, report, console, and recipe capture.

Read next:

- [Root README](../README.md)
- [Recipes](./recipes.md)
- [Demo Script](./demo.md)
- [CLI Reference](./cli-reference.md)

## Hybrid Local Plus Live Connectors

Use this when the deployment still runs locally but one or more customer-facing systems are live. This is the common design-partner path: local enough to iterate quickly, live enough to prove integration value.

| Layer | Choice |
| --- | --- |
| Provider | `mock`, local Ollama, or a hosted provider such as OpenAI, Anthropic, or Google |
| Connectors | Mix local context with live write paths, for example local customer API plus Slack/GitHub/Jira/Linear/HubSpot/Salesforce API mode |
| Environment | Optional Docker or Floci local environment around the customer API |
| Artifacts | Local `artifacts/` outputs, reviewed after every run |
| Governance | Approval gates on write tools, `fdekit doctor --live`, strict validation before customer demos, feedback export into evals |

Recommended path:

```bash
fdekit doctor --live
fdekit validate --strict
fdekit run <agent> --strict
fdekit approvals list
fdekit feedback export
fdekit eval run
fdekit eval macro
fdekit report
fdekit console
```

This architecture is best when the team needs real Slack messages, issues, CRM notes, or load-test output, but still wants local iteration speed and visible review artifacts.

Read next:

- [Connector Cookbook](./cookbook/connectors.md)
- [Local Environment Cookbook](./cookbook/local-environments.md)
- [Versioning And Migration Notes](./cookbook/versioning-and-migrations.md)
- [Support Matrix](./support-matrix.md)

## Production-Shaped Governance-Heavy Setup

Use this when the deployment needs customer handoff, pilot readiness, or production-style review. It can still run before full production, but the evidence and controls should look production-shaped.

| Layer | Choice |
| --- | --- |
| Provider | Hosted provider or local provider with explicit runtime adapter path |
| Connectors | Live connectors with scoped credentials, allowlists, table restrictions, and approval-gated write tools |
| Environment | Staging, customer sample, shadow, or approved-write environment; Docker/Floci only when local emulation is the target |
| Artifacts | Artifact store retained outside ephemeral local folders when required by the customer |
| Governance | `validate --strict`, `run --strict`, approvals, audit log, redaction, budget caps, tool scopes, environment restrictions, evals, macro evals, diffs, migration notes, report, console exports |

Minimum release loop:

```bash
fdekit doctor --live
fdekit validate --strict
fdekit diff
fdekit run <agent> --strict
fdekit approvals list
fdekit audit
fdekit eval run
fdekit eval macro
fdekit report
fdekit console
```

This architecture is best for pilots, staged rollout, and customer review. The standard should be simple: every risky action is explicit, measured, reversible, and visible.

Read next:

- [Field Deployment Method](./field-deployment-method.md)
- [Production Hardening Guide](./production-hardening.md)
- [Versioning And Migration Notes](./cookbook/versioning-and-migrations.md)
- [Public API Reference](./api-reference.md)

## Next Step

If you chose an architecture, return to the [Start Here learning map](./README.md#start-here-learning-map) and follow the matching track end to end.
