# Support Matrix

FDEKit is pre-1.0, so this matrix is explicit about maturity. The local CLI/runtime path is designed to be demo-ready today. External API adapters are covered by mocked contract tests and should be verified with opt-in live smoke tests before depending on them in a customer production workflow.

Maturity levels:

- **Ready**: documented, tested, and used by the default examples.
- **Beta**: implemented with contract tests and resilience defaults; validate with real credentials for your account.
- **Experimental**: useful for demos or customization, but APIs may change.
- **Planned**: on the roadmap, not part of the current package surface.

## Runtime And Tooling

| Area | Support | Maturity | Notes |
| --- | --- | --- | --- |
| Node.js | `>=18` | Ready | Uses Node ESM/NodeNext and built-in `fetch`. Node 20+ is recommended for active development. |
| Package manager | npm workspaces | Ready | The repo uses npm workspaces and Turbo. Other package managers are not part of the supported path yet. |
| TypeScript | TS 5.x, ESM output | Ready | Source imports use `.js` specifiers intentionally so emitted NodeNext ESM is valid. |
| Runtime mode | Local filesystem runtime | Ready | Traces, evals, approvals, audit logs, reports, exports, and console artifacts default to `.fdekit`. |
| Artifact storage | S3 artifact store | Beta | Configurable through deployment `artifacts`; requires a caller-supplied S3 adapter client and project-owned bucket permissions. |
| Runtime environments | `runtimeEnvironment` plus `fdekit env` commands | Experimental | Used for local customer-like environments such as Docker Compose or Floci. Agent runs still talk to the customer API URL. |
| Hosted runtime service | Not included | Planned | Runtime-as-a-service, auth, tenancy, and durable multi-tenant trace/audit APIs are roadmap items. |

## Providers

<!-- fdekit-catalog:provider-support:start -->
| Provider | Package / config | Maturity | Notes |
| --- | --- | --- | --- |
| Mock | `@fdekit/provider-mock` / `mock` | Ready | Credential-free deterministic provider for recipes, evals, demos, and CI |
| Local Ollama | `@fdekit/provider-ollama` / `localOllamaProvider()` | Beta | Talks to a local Ollama server, defaulting to `http://127.0.0.1:11434`; model quality depends on the selected local model |
| OpenAI | `@fdekit/provider-openai` / `openaiProvider()` | Beta | Uses `OPENAI_API_KEY` by default, supports custom API base URLs or an injected official `openai` SDK client, and is covered by mocked API contract tests |
| Anthropic | `@fdekit/provider-anthropic` / `anthropicProvider()` | Beta | Uses `ANTHROPIC_API_KEY` by default, supports custom API base URLs or an injected official `@anthropic-ai/sdk` client, and is covered by mocked API contract tests |
| Google Gemini | `@fdekit/provider-google` / `googleProvider()` | Beta | Uses `GEMINI_API_KEY` by default, supports custom API base URLs or an injected official `@google/genai` client, and is covered by mocked API contract tests |
<!-- fdekit-catalog:provider-support:end -->

| Planned provider capability | Support | Maturity | Notes |
| --- | --- | --- | --- |
| Provider routing and fallback | Not included | Planned | Model fallback, cheap/fast routing, and model-specific budgeting are roadmap items. |

## Connectors

Custom connectors with `defineConnector()` and `defineTool()` are ready for customer-specific systems, custom tools, and advanced recipe customization.

<!-- fdekit-catalog:connector-support:start -->
| Connector | Package / config | Maturity | Notes |
| --- | --- | --- | --- |
| Customer API | `@fdekit/connector-customer-api` | Ready | Default support-triage connector for customer-owned HTTP APIs and custom adapter patterns |
| Codebase | `@fdekit/connector-codebase` | Ready | Local repository search and file reads for codebase-agent workflows |
| Slack | `@fdekit/connector-slack` | Beta | Supports demo/local mode and API mode for posting escalation messages with mocked contract coverage |
| GitHub | `@fdekit/connector-github` | Beta | Supports demo/local mode and API mode for issue creation with mocked contract coverage |
| Jira | `@fdekit/connector-jira` | Beta | Supports demo/local mode and API mode for issue creation, plus the shared `issue.create` tool pattern |
| Linear | `@fdekit/connector-linear` | Beta | Supports demo/local mode and API mode for issue creation, plus the shared `issue.create` tool pattern |
| Postgres | `@fdekit/connector-postgres` | Beta | Governance-first SQL validation, schema discovery, query timeouts, optional pooling, and read-only defaults |
| k6 load testing | `@fdekit/connector-k6` | Beta | Runs governed load tests through deterministic local mode or a local k6 binary, with VU/duration caps and threshold evidence; real k6 execution requires the Grafana k6 CLI installed separately |
| HubSpot | `@fdekit/connector-hubspot` | Beta | Supports demo/local mode and API mode for sales-research CRM workflows with mocked contract coverage |
| Salesforce | `@fdekit/connector-salesforce` | Beta | Supports demo/local mode and API mode for sales-research CRM workflows with mocked contract coverage |
<!-- fdekit-catalog:connector-support:end -->

| Planned connector capability | Support | Maturity | Notes |
| --- | --- | --- | --- |
| MCP | Not included | Planned | MCP server integration is part of the connector roadmap. |

## Packages

This repository uses npm workspaces and Turborepo.

| Runtime package | Purpose |
| --- | --- |
| `@fdekit/core` | Public TypeScript primitives for deployments, agents, tools, connector schemas, governance, policies, evals, and recipes. |
| `@fdekit/runtime` | Config loading, agent loop execution, traces, approvals, audit logs, evals, reports, and artifact store IO. |
| `@fdekit/cli` | CLI package that installs the `fdekit` binary. |
| `@fdekit/console` | Static local dashboard renderer. |

### Provider Packages

<!-- fdekit-catalog:provider-packages:start -->
| Package | Purpose |
| --- | --- |
| `@fdekit/provider-mock` | Deterministic local provider for tests and demos |
| `@fdekit/provider-ollama` | Local Ollama provider |
| `@fdekit/provider-openai` | OpenAI provider adapter |
| `@fdekit/provider-anthropic` | Anthropic provider adapter |
| `@fdekit/provider-google` | Google Gemini provider adapter |
<!-- fdekit-catalog:provider-packages:end -->

### Environment Packages

| Package | Purpose |
| --- | --- |
| `@fdekit/environment-docker` | Docker Compose local environment package for customer-like local stacks. |
| `@fdekit/environment-floci` | Floci local cloud environment package for customer-like local runtime stacks. |

### Connector Packages

<!-- fdekit-catalog:connector-packages:start -->
| Package | Purpose |
| --- | --- |
| `@fdekit/connector-customer-api` | Customer, ticket, and escalation tools for support deployments |
| `@fdekit/connector-codebase` | Local repository listing, search, and file reads |
| `@fdekit/connector-slack` | Local/API Slack-style messaging |
| `@fdekit/connector-github` | Local/API GitHub-style issue creation with common `issue.create` |
| `@fdekit/connector-jira` | Local/API Jira issue creation with common `issue.create` |
| `@fdekit/connector-linear` | Local/API Linear issue creation with common `issue.create` |
| `@fdekit/connector-postgres` | Governed Postgres schema discovery and query execution |
| `@fdekit/connector-k6` | Governed k6-compatible load-test execution from the agent runtime |
| `@fdekit/connector-hubspot` | Local/API HubSpot note creation with common `crm.note.create` |
| `@fdekit/connector-salesforce` | Local/API Salesforce task creation with common `crm.note.create` |
<!-- fdekit-catalog:connector-packages:end -->

## System Dependencies

| Area | What must be installed |
| --- | --- |
| OpenAI, Anthropic, Google providers | No provider SDK package is required. Set the relevant API key env var. |
| Ollama provider | Run Ollama separately and point `OLLAMA_BASE_URL` at it when needed. |
| Slack, GitHub, Jira, Linear, HubSpot, Salesforce connectors | API mode uses HTTPS plus credentials; local mode is deterministic and credential-free. |
| Postgres connector | Direct `pg` mode requires the optional peer dependency `pg`. Install `pg`, or pass `postgresConnector({ queryClient })` to use a customer-provided client. |
| k6 connector | Local mode is deterministic and requires no k6 install. `mode: 'k6'` requires the Grafana k6 CLI on `PATH`, or a custom `k6Command` pointing at a k6-compatible executable. FDEKit does not download, vendor, or install the k6 binary. |
| Docker environment | The default command uses the local Docker Compose CLI. |
| Floci environment | The default command uses local Docker to run the Floci image; custom commands can use Docker Compose or a Floci CLI if the customer stack already has one. |

The machine still needs the underlying runtime available, usually Docker plus access to the `floci/floci`, `floci/floci-az`, or `floci/floci-gcp` image.

## External API Resilience

Provider and connector integrations are covered with mocked contract tests for URL construction, auth headers, payload shape, response parsing, and missing credential failures. That gives CI confidence without requiring live API credentials.

HTTP-based providers and connectors use shared resilience defaults:

- retry retryable failures such as `429`, `500`, `502`, `503`, and `504`,
- exponential backoff with jitter,
- an in-memory circuit breaker to stop hammering a failing external service,
- per-adapter overrides through the `resilience` option.

Live credential smoke tests are intentionally separate from normal CI because they call paid or customer-owned services. The current suite proves the adapter contract; opt-in sandbox smokes catch vendor API drift when a team chooses to run them.

Run the opt-in smoke harness from this repo after building packages:

```bash
FDEKIT_LIVE_SMOKE_SANDBOX=true npm run connectors:smoke:live
```

Use `FDEKIT_LIVE_SMOKE_CONNECTORS=github,slack` to limit the run, or add `-- --require-at-least-one` to fail when no configured connector runs.

Configure sandbox-only targets with the standard connector env vars:

| Connector | Secrets | Variables |
| --- | --- | --- |
| GitHub | `GITHUB_TOKEN` | `GITHUB_REPOSITORY` |
| Slack | `SLACK_BOT_TOKEN` | `SLACK_CHANNEL_ID` |
| Jira | `JIRA_EMAIL`, `JIRA_API_TOKEN` | `JIRA_BASE_URL`, `JIRA_PROJECT_KEY` |
| Linear | `LINEAR_API_KEY` | `LINEAR_TEAM_ID` |
| HubSpot | `HUBSPOT_ACCESS_TOKEN` | `HUBSPOT_PORTAL_ID` |
| Salesforce | `SALESFORCE_ACCESS_TOKEN` | `SALESFORCE_INSTANCE_URL`, `SALESFORCE_ACCOUNT_ID` |

Every configured live smoke writes a small sandbox artifact, such as an issue, Slack message, CRM note, or Salesforce task. Do not point this harness at production projects, channels, portals, or orgs. FDEKit does not require customers to run scheduled jobs; teams can run the command manually, before a release, or inside their own CI if that matches their governance model.

## Next Step

If you just checked package or connector maturity, choose the matching setup in [Reference Architectures](./reference-architectures.md). For live connector work, continue to the [Hybrid Local Plus Live Connectors](./reference-architectures.md#hybrid-local-plus-live-connectors) path before customer handoff.
