# CLI Reference

The `fdekit` CLI is organized around a deployment loop: scaffold, configure, validate, run, review evidence, then capture the work as a recipe.

Install the CLI package with `npm install -D @fdekit/cli`; it provides the `fdekit` binary used below.

## Common Loop

For the launch demo from this repository, prefer the one-command runner:

```bash
npm run demo
```

The CLI commands below are the primitives that runner executes and the commands you use when debugging or operating an installed project.

```bash
fdekit doctor
fdekit validate
fdekit run <agent> [--input <json>] [--strict]
fdekit feedback export
fdekit eval run
fdekit eval macro
fdekit report
fdekit console
```

Use `fdekit validate --strict` before customer handoff or production-shaped pilots. Use `fdekit run <agent> --strict` when you want the runtime to enforce the same tool metadata gate before any handler executes.

## Project And Recipe Commands

| Command | Purpose |
| --- | --- |
| `fdekit init [name]` | Scaffold a new FDEKit deployment. |
| `fdekit recipe install <name>` | Install a built-in recipe: `support-triage`, `codebase-agent`, `sales-research-agent`, or `load-test-agent`. |
| `fdekit recipe install <path-to-local-recipe>` | Install a recipe captured from another project. |
| `fdekit recipe capture <name> [--force]` | Capture the current deployment as a reusable local recipe. |

## Add Commands

| Command | Purpose |
| --- | --- |
| `fdekit add provider <name>` | Add a provider such as `localOllama`, `openai`, `anthropic`, or `google`. |
| `fdekit add connector <name>` | Add a connector such as `github`, `slack`, `postgres`, `jira`, `linear`, `hubspot`, `salesforce`, or `k6`. |
| `fdekit add policy <name>` | Add a policy helper. |
| `fdekit add eval <name>` | Add a simple eval to the current deployment. |

## Catalog-Backed Names

<!-- fdekit-catalog:cli-catalog:start -->
| Surface | Built-ins |
| --- | --- |
| Recipes | `support-triage`, `codebase-agent`, `sales-research-agent`, `load-test-agent` |
| Providers | `mock`, `localOllama`, `openai`, `anthropic`, `google`; aliases: `ollama`, `gemini` |
| Connectors | `customer-api`, `codebase`, `slack`, `github`, `jira`, `linear`, `postgres`, `k6`, `hubspot`, `salesforce` |
<!-- fdekit-catalog:cli-catalog:end -->

## Validation And Change Review

| Command | Purpose |
| --- | --- |
| `fdekit doctor [--live]` | Check env setup; `--live` runs connector health checks. |
| `fdekit validate [--json] [--strict]` | Validate config and write a deployment snapshot plus `deployments/execution-plan.json` through the configured artifact store. `--strict` requires every tool to declare `argsSchema`, `scopes`, and `environments`. |
| `fdekit diff [--from <snapshot>] [--to <config-or-snapshot>]` | Compare deployment snapshots or configs. |

See [Versioning And Migration Notes](./cookbook/versioning-and-migrations.md) for the recommended upgrade flow.

## Runtime And Evidence

| Command | Purpose |
| --- | --- |
| `fdekit dev` | Load the deployment and write a trace. |
| `fdekit run <agent> [--input <json>] [--strict]` | Run an agent loop and write a trace. `--strict` requires every available tool to declare `argsSchema`, `scopes`, and `environments`, then validates tool args before handlers run. |
| `fdekit approvals list` | Show approval requests. |
| `fdekit approvals approve <id> --by <user> --reason <reason>` | Approve a queued request. |
| `fdekit approvals reject <id> --by <user> --reason <reason>` | Reject a queued request. |
| `fdekit audit [--limit <n>]` | Show recent audit log entries. |
| `fdekit feedback export [--json]` | Export approval/audit feedback into eval candidates. |
| `fdekit trace` | Generate an HTML trace viewer. |
| `fdekit report` | Generate a deployment report. |
| `fdekit console` | Generate an HTML dashboard and export artifacts. |

Runtime evidence commands write through the configured artifact store. With no `deployment.artifacts` config, outputs stay under local `.fdekit`. With S3 configured, command output prints `s3://...` URIs.

## Evals

| Command | Purpose |
| --- | --- |
| `fdekit eval run` | Run configured lower-level evals. |
| `fdekit eval macro [--min-frequency <n>]` | Discover recurring behavior patterns across traces. |

## Runtime Environments

| Command | Purpose |
| --- | --- |
| `fdekit env start` | Start the configured runtime environment. |
| `fdekit env seed` | Seed the environment if a seed command is configured. |
| `fdekit env doctor` | Check the environment health checks. |
| `fdekit env stop` | Stop the environment. |
| `fdekit env describe` | Print environment metadata and evidence. |

See [Local Environment Cookbook](./cookbook/local-environments.md) for Docker and Floci examples.

## Next Step

If you just finished the command map, use the [Concept-To-Command Index](./README.md#concept-to-command-index) when you know the concept but not the command. For deployment hardening, continue to the [Production Hardening Guide](./production-hardening.md). For custom systems, continue to the [Connector Cookbook](./cookbook/connectors.md).
