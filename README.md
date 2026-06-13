# FDEKit

FDEKit is a field-deployment operating layer for forward-deployed engineers. It helps you scaffold agent deployments, connect customer systems, enforce governance, run evals, inspect traces, and package repeatable customer work into reusable recipes.

The goal is to make governed, evaluated, observable AI deployments accessible.

## Why It Exists

Most agent frameworks help you call models and tools. FDEKit focuses on the deployment work around the agent:

- recipes for repeatable customer patterns
- connectors for Slack, GitHub, Jira, Linear, Postgres, HubSpot, Salesforce, k6, customer APIs, and codebases
- providers for `mock`, local Ollama, OpenAI, Anthropic, and Gemini
- governance with approval gates, audit logs, PII and secret handling, permission scopes, environment separation, and budget caps
- evals for tool calls, final answers, latency, cost, policy violations, and recurring behavior patterns
- a local console for traces, evals, approvals, policy posture, cost, latency, connector evidence, reports, and exports

FDEKit is designed around this operating loop:

```txt
discover workflow -> score ROI/risk -> split deterministic/agent/human work -> connect existing systems -> run staged rollout -> capture feedback/evidence
```

## Quickstart

This path runs the launch demo: the credential-free `mock` provider, the bundled support-triage workflow, governance, evals, report, console, and recipe capture.

Prerequisites:

- Node.js 18 or newer
- npm

From the repo root:

```bash
npm install
npm run demo
```

The demo command builds the workspace, checks that runnable examples still match scaffold output, starts the sample customer API, runs the deployment loop, generates report and console artifacts, and captures the working deployment as a reusable recipe.

Inspect both outputs:

```txt
examples/support-triage/.fdekit/console.html
examples/support-triage/recipes/support-renewal-risk/
```

The console shows traces, tool calls, policy checks, eval status, macro patterns, report content, and connector evidence. The captured recipe is the reusable handoff artifact: config, workflow notes, agent prompt, evals, and a deployment snapshot that can be installed into the next customer project.

For a fresh project using the npm package:

```bash
mkdir support-demo
cd support-demo
npm install -D fdekit
npx fdekit init
npx fdekit recipe install support-triage
npm install
npm run demo
```

The installed recipe's `npm run demo` script starts the local customer API on `127.0.0.1:8787`, waits for `/health`, runs the same governed loop, captures `recipes/support-renewal-risk/`, and shuts the API down when it finishes.

## What To Do Next

1. Understand the method: [Field Deployment Method](./docs/field-deployment-method.md).
2. Try another recipe: [Recipes](./docs/recipes.md).
3. Add customer systems: [Connector Cookbook](./docs/cookbook/connectors.md).
4. Run customer-like local systems: [Local Environment Cookbook](./docs/cookbook/local-environments.md).
5. Validate and diff deployment changes: [Versioning And Migration Notes](./docs/cookbook/versioning-and-migrations.md).
6. Prepare a pilot or production path: [Production Hardening Guide](./docs/production-hardening.md).

The full docs index is [docs/README.md](./docs/README.md). For symbol lookup, use the API references for [`@fdekit/core`](./docs/api/core.md), [`@fdekit/runtime`](./docs/api/runtime.md), and the [`fdekit` CLI](./docs/api/cli.md).

## Recipes

<!-- fdekit-catalog:recipe-table:start -->
| Recipe | What it proves | Local by default | Live path |
| --- | --- | --- | --- |
| `support-triage` | Customer API lookup, support escalation, Slack notification, issue creation, approval evidence, report | Local API, local Slack-style message, local GitHub-style issue | Slack API and GitHub API |
| `codebase-agent` | Search/read a customer repo, create an engineering issue, run codebase evals | Local sample repo and local issue creation | GitHub, Jira, or Linear |
| `sales-research-agent` | Research an account, gather buyer context, create a CRM note | Local CRM/research dataset and local CRM note | HubSpot or Salesforce |
| `load-test-agent` | Run governed load tests from the agent runtime and capture threshold evidence | Deterministic local load-test result | Local k6 CLI against a customer API |
<!-- fdekit-catalog:recipe-table:end -->

Install one with:

```bash
npx fdekit recipe install <support-triage|codebase-agent|sales-research-agent|load-test-agent>
```

See [Recipes](./docs/recipes.md) for commands, env vars, and live connector paths.

## CLI

Common commands:

```bash
fdekit init [name]
fdekit recipe install <name>
fdekit recipe capture <name> [--force]
fdekit add provider <name>
fdekit add connector <name>
fdekit add policy <name>
fdekit doctor [--live]
fdekit validate [--json] [--strict]
fdekit diff [--from <snapshot>] [--to <config-or-snapshot>]
fdekit run <agent> [--input <json>] [--strict]
fdekit approvals list
fdekit audit
fdekit feedback export
fdekit eval run
fdekit eval macro
fdekit report
fdekit console
```

See [CLI Reference](./docs/cli-reference.md) for the full command map.

## Comparison

FDEKit does not replace observability or eval platforms. It is the local deployment workbench around them: connector scaffolds, governance defaults, approval evidence, reports, and the captured recipe that turns one customer deployment into the next reusable pattern.

| Buyer question | Strong alternatives | What they are best at | FDEKit answer |
| --- | --- | --- | --- |
| "Do we already get traces and evals from our AI observability platform?" | [LangSmith](https://docs.langchain.com/langsmith/home), [Langfuse](https://langfuse.com/docs), [Braintrust](https://www.braintrust.dev/docs) | Tracing, dashboards, prompt iteration, datasets, evals, production monitoring, and team review workflows | Keep using them for observability. Use FDEKit to scaffold the customer deployment, enforce local governance, generate stakeholder evidence, and capture the working workflow as an installable recipe. |
| "Can our agent platform handle governance?" | [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) and hosted agent platforms | Agent loops, tools, handoffs, guardrails, tracing, hosted runtime controls, and platform-native deployment paths | Use those runtimes where they fit. FDEKit owns the field-deployment contract around the runtime: providers, connectors, policies, approvals, eval refs, artifact paths, and repeatable recipe handoff. |
| "Why not just use LangChain/LangGraph?" | LangChain, LangGraph, provider SDKs, MCP servers | Orchestration, model calls, tool calling, graph state, and integration primitives | FDEKit can sit above those primitives. It standardizes the deployment folder, support matrix, governance posture, eval/report/console artifacts, and recipe capture. |
| "Why not keep internal scripts?" | Bash, notebooks, one-off app code | Fast local automation for one workflow | FDEKit keeps the local speed but adds validation, auditability, approval queues, evals, console/report output, and a recipe bundle the team can install again. |

## Support

FDEKit is pre-1.0. External API adapters are covered by mocked contract tests and should be verified with opt-in live smoke tests before customer production use.

See [Support Matrix](./docs/support-matrix.md) for package maturity, providers, connectors, environment support, and system dependencies.

## Development

From the repository root:

```bash
npm install
npm run demo
```

For repeated recordings after a successful build:

```bash
npm run demo:fast
```

Use the lower-level scripts when you are debugging one stage of the loop:

```bash
npm run build
npm run test
npm run example:api
```

In another terminal:

```bash
npm run example:doctor
npm run example:validate
npm run example:run
npm run example:feedback
npm run example:eval
npm run example:macro
npm run example:console
```

Open `examples/support-triage/.fdekit/console.html`.

For maintainer-facing package boundaries, runtime flow, artifact lifecycle, and ADRs, see [Maintainer Architecture](./docs/architecture.md). For public symbols, start with [Public API Reference](./docs/api-reference.md).

## Next Step

If you just finished the quickstart, read the [Start Here learning map](./docs/README.md#start-here-learning-map). Choose Track A for another 30-minute recipe, Track B to harden the deployment, or Track C to add a custom connector/tool.

## Contributing

FDEKit is MIT licensed and open to contributions. Start with [CONTRIBUTING.md](./CONTRIBUTING.md), and please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

Good first contribution areas:

- improve recipe docs and onboarding
- add focused tests for connectors, policies, eval assertions, and CLI scaffolds
- tighten dashboard UX and exported reports
- add connector health checks
- add examples that demonstrate real customer deployment patterns

## License

MIT. See [LICENSE](./LICENSE).
