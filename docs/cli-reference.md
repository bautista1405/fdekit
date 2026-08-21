# CLI Reference

The `fdekit` CLI is organized around a deployment loop: scaffold, configure, validate, run, review evidence, then capture the work as a recipe.

Install the CLI package with `npm install -g @fdekit/cli` to put the `fdekit` command on your shell `PATH`. Scaffolded projects also pin `@fdekit/cli` locally so npm scripts use the project version.

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
fdekit eval run [target]
fdekit eval macro
fdekit report
fdekit console
```

Use `fdekit validate --strict` before customer handoff or production-shaped pilots. Use `fdekit run <agent> --strict` when you want the runtime to enforce the same tool metadata gate before any handler executes.

## Project And Recipe Commands

| Command | Purpose |
| --- | --- |
| `fdekit init [name]` | Scaffold a new FDEKit deployment. Without a name, files are created in `./fdekit`. |
| `fdekit recipe install <name>` | Install a built-in recipe: `support-triage`, `codebase-agent`, `sales-research-agent`, or `load-test-agent`. |
| `fdekit recipe install <path-to-local-recipe>` | Install a recipe captured from another project. |
| `fdekit recipe capture <name> [--force]` | Capture the current deployment as a reusable local recipe. |

## Add Commands

| Command | Purpose |
| --- | --- |
| `fdekit add provider <name>` | Add a provider such as `localOllama`, `openai`, `anthropic`, or `google`. |
| `fdekit add connector <name> [--custom]` | Add a catalog connector such as `github`, `slack`, `postgres`, `jira`, `linear`, `hubspot`, `salesforce`, or `k6`. Unknown names fail unless `--custom` explicitly requests a project-specific connector stub. |
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
| `fdekit doctor [--live]` | Check env setup plus provider and connector readiness (model availability, codebase navigation prerequisites); `--live` also runs connector `*.healthCheck` tools. |
| `fdekit validate [--json] [--strict]` | Validate config and write a deployment snapshot plus `deployments/execution-plan.json` through the configured artifact store. `--strict` requires every tool to declare `argsSchema`, `scopes`, and `environments`. |
| `fdekit diff [--from <snapshot>] [--to <config-or-snapshot>]` | Compare deployment snapshots or configs. |

See [Versioning And Migration Notes](./cookbook/versioning-and-migrations.md) for the recommended upgrade flow.

## Runtime And Evidence

| Command | Purpose |
| --- | --- |
| `fdekit dev` | Load the deployment and write a trace. |
| `fdekit run <agent> [--input <json>] [--strict]` | Run an agent loop and write a trace. `--strict` requires every available tool to declare `argsSchema`, `scopes`, and `environments`, then validates tool args before handlers run. |
| `fdekit run <agent> --resume [runId]` | Continue a run paused on an approval: executes the exact approved tool call (no re-planning) and resumes the loop without replaying earlier writes. Without `runId`, resumes the agent's latest paused run. |
| `fdekit approvals list [--status <s>] [--tool <t>] [--json]` | Show approval requests with their args and execution target; filter by status or tool. |
| `fdekit approvals show <id> [--json]` | Show one request in full: args, target system, decision history, execution record. |
| `fdekit approvals edit <id> --args <json> [--by <user>] [--reason <reason>]` | Validate corrected tool arguments, supersede the pending request, and issue a fresh exact approval fingerprint. |
| `fdekit approvals approve <id> [--by <user>] [--reason <reason>] [--force]` | Approve a queued request. `--by` defaults to the OS username; `--force` is required to overturn an existing decision (history is preserved). |
| `fdekit approvals reject <id> [--by <user>] [--reason <reason>] [--force]` | Reject a queued request; a rejected run reports `Status: rejected`. |
| `fdekit audit [--limit <n>]` | Show recent audit log entries. |
| `fdekit feedback export [--json]` | Export approval/audit feedback into eval candidates. |
| `fdekit trace` | Generate an HTML trace viewer. |
| `fdekit report` | Generate a deployment report. |
| `fdekit console` | Generate an HTML dashboard and export artifacts. |

Runtime evidence commands write through the configured artifact store. With no `deployment.artifacts` config, outputs stay under local `artifacts/`. With S3 configured, command output prints `s3://...` URIs.

`fdekit run` exit codes: `0` completed, `1` failed (including `completed_with_errors`, where a tool call failed but the loop finished, and `rejected`), `2` paused waiting for approval. Approvals are fingerprinted against the execution target (connector name, mode, repository/channel/base URL), so approvals granted against simulated connectors do not authorize live-mode writes.

## Evals

`fdekit feedback export` writes replay-ready cases to
`artifacts/feedback/eval-cases.json`. Each case uses the original redacted agent run input;
approval arguments, rationale, decision, and provenance stay under `metadata`. Point an eval
at that dataset to turn reviewed decisions into regressions:

```ts
import { defineEval, expectedApprovalOutcome } from '@fdekit/core';

defineEval({
  name: 'approval-feedback',
  agent: 'supportTriage',
  dataset: './artifacts/feedback/eval-cases.json',
  assertions: [expectedApprovalOutcome()],
})
```

`expectedApprovalOutcome()` interprets each exported case's `expected.toolName` and
`expected.shouldProceed`: approved decisions require the tool call to occur, while rejected
decisions require it not to occur. The runtime also recognizes this conventional expected
shape during agent-backed evals, while the explicit assertion makes the contract visible and
composable in config. Decisions from legacy artifacts are skipped when neither their trace
nor audit event contains a recoverable run input.

| Command | Purpose |
| --- | --- |
| `fdekit eval run [target] [--require-approvals]` | Run all lower-level evals, or one agent/eval suite target. Approval gates are auto-decided by default (recorded as `eval-runner`; cases with `expected.shouldProceed: false` auto-reject); `--require-approvals` keeps production pause behavior. |
| `fdekit eval macro [--min-frequency <n>]` | Discover recurring behavior patterns across traces. |

Failing suites print their failing assertions inline; full results stay in `artifacts/evals/latest.json`. The `approvalRequested(toolName?)` assertion from `@fdekit/core` passes when a run requested an approval, so gating itself becomes testable.

## Runtime Environments

| Command | Purpose |
| --- | --- |
| `fdekit env start` | Start the configured runtime environment. Commands marked `background: true` run detached with a pidfile, and start returns once health checks pass; if the environment is already healthy, start is a no-op. |
| `fdekit env seed` | Seed the environment if a seed command is configured. |
| `fdekit env doctor [--json]` | Check the environment health checks. Command-based checks print their output only on failure. |
| `fdekit env stop` | Stop the environment: runs stop commands, then stops any recorded background processes. |
| `fdekit env describe` | Print environment metadata, evidence, commands, and health checks. |

See [Local Environment Cookbook](./cookbook/local-environments.md) for Docker and Floci examples.

## Next Step

If you just finished the command map, use the [Concept-To-Command Index](./README.md#concept-to-command-index) when you know the concept but not the command. For deployment hardening, continue to the [Production Hardening Guide](./production-hardening.md). For custom systems, continue to the [Connector Cookbook](./cookbook/connectors.md).
