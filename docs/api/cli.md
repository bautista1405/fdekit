# fdekit CLI API Reference

<!-- Maintained via scripts/generate-api-docs.mjs. -->
Run `npm run docs:api` to refresh this page after changing public exports.

Applies to `@fdekit/cli` v0.4.0. The installed binary remains `fdekit`.

Declaration source: `packages/cli/dist/index.d.ts`; command map source: `scripts/generate-api-docs.mjs`.

## Stability And Audience

| Stability | Intended audience |
| --- | --- |
| Public, pre-1.0 command surface; no stable TypeScript import API | Deployment authors using the binary, recipe authors, and CLI contributors. |

- The package root declaration exports no TypeScript symbols; use the `fdekit` binary as the public surface.
- Command implementation files are linked so contributors can find where behavior lives quickly.

## Top Commands

| Command | Why advanced users reach for it |
| --- | --- |
| [`fdekit init [name]`](#fdekit-init-name) | Start a deployment project with the expected FDEKit shape, defaulting to ./fdekit. |
| [`fdekit recipe install <name>`](#fdekit-recipe-install-name) | Bring in a bundled recipe and its docs, evals, and config. |
| [`fdekit validate [--json] [--strict]`](#fdekit-validate-json-strict) | Check config readiness and write reviewable deployment artifacts. |
| [`fdekit diff [--from <snapshot>] [--to <config-or-snapshot>]`](#fdekit-diff-from-snapshot-to-config-or-snapshot) | Review deployment changes before customer handoff. |
| [`fdekit run <agent> [--input <json>] [--strict]`](#fdekit-run-agent-input-json-strict) | Execute an agent loop with trace and policy evidence. |
| [`fdekit eval run`](#fdekit-eval-run) | Run configured eval suites. |
| [`fdekit eval macro [--min-frequency <n>]`](#fdekit-eval-macro-min-frequency-n) | Find repeated behavior patterns across traces. |
| [`fdekit approvals list`](#fdekit-approvals-list) | Inspect pending approval requests. |
| [`fdekit feedback export [--json]`](#fdekit-feedback-export-json) | Turn approval and audit decisions into eval candidates. |
| [`fdekit console`](#fdekit-console) | Generate the local dashboard and exports. |
| [`fdekit env doctor`](#fdekit-env-doctor) | Check configured runtime environment health. |

## TypeScript Exports

The package root exports 3 TypeScript symbols.

## Command Symbols

| Command | Purpose | Defined in |
| --- | --- | --- |
| <a id="fdekit-init-name"></a>`fdekit init [name]` | Scaffold a new FDEKit deployment, defaulting to ./fdekit. | [packages/cli/src/commands/init.ts](../../packages/cli/src/commands/init.ts) |
| <a id="fdekit-add-provider-name"></a>`fdekit add provider <name>` | Add a provider config and env docs. | [packages/cli/src/commands/add.ts](../../packages/cli/src/commands/add.ts) |
| <a id="fdekit-add-connector-name"></a>`fdekit add connector <name>` | Add a connector config and env docs. | [packages/cli/src/commands/add.ts](../../packages/cli/src/commands/add.ts) |
| <a id="fdekit-add-policy-name"></a>`fdekit add policy <name>` | Add a policy helper to the current deployment. | [packages/cli/src/commands/add.ts](../../packages/cli/src/commands/add.ts) |
| <a id="fdekit-add-eval-name"></a>`fdekit add eval <name>` | Add a simple eval to the current deployment. | [packages/cli/src/commands/add.ts](../../packages/cli/src/commands/add.ts) |
| <a id="fdekit-recipe-install-name"></a>`fdekit recipe install <name>` | Install a bundled recipe. | [packages/cli/src/commands/recipe/install.ts](../../packages/cli/src/commands/recipe/install.ts) |
| <a id="fdekit-recipe-install-path"></a>`fdekit recipe install <path>` | Install a captured local recipe from a filesystem path. | [packages/cli/src/commands/recipe/install.ts](../../packages/cli/src/commands/recipe/install.ts) |
| <a id="fdekit-recipe-capture-name"></a>`fdekit recipe capture <name>` | Capture the current deployment as a reusable local recipe. | [packages/cli/src/commands/recipe/capture.ts](../../packages/cli/src/commands/recipe/capture.ts) |
| <a id="fdekit-doctor-live"></a>`fdekit doctor [--live]` | Check project readiness and optionally run live connector health checks. | [packages/cli/src/commands/doctor.ts](../../packages/cli/src/commands/doctor.ts) |
| <a id="fdekit-validate-json-strict"></a>`fdekit validate [--json] [--strict]` | Validate config and write deployment snapshots plus an execution plan. | [packages/cli/src/commands/validate.ts](../../packages/cli/src/commands/validate.ts) |
| <a id="fdekit-diff-from-snapshot-to-config-or-snapshot"></a>`fdekit diff [--from <snapshot>] [--to <config-or-snapshot>]` | Compare deployment snapshots or configs. | [packages/cli/src/commands/diff.ts](../../packages/cli/src/commands/diff.ts) |
| <a id="fdekit-dev"></a>`fdekit dev` | Load the deployment and write a local development trace. | [packages/cli/src/commands/dev.ts](../../packages/cli/src/commands/dev.ts) |
| <a id="fdekit-run-agent-input-json-strict"></a>`fdekit run <agent> [--input <json>] [--strict]` | Run an agent loop and write a trace. | [packages/cli/src/commands/run.ts](../../packages/cli/src/commands/run.ts) |
| <a id="fdekit-eval-run"></a>`fdekit eval run` | Run configured lower-level evals. | [packages/cli/src/commands/eval.ts](../../packages/cli/src/commands/eval.ts) |
| <a id="fdekit-eval-macro-min-frequency-n"></a>`fdekit eval macro [--min-frequency <n>]` | Discover recurring behavior patterns across traces. | [packages/cli/src/commands/eval.ts](../../packages/cli/src/commands/eval.ts) |
| <a id="fdekit-approvals-list"></a>`fdekit approvals list` | List approval requests. | [packages/cli/src/commands/approvals.ts](../../packages/cli/src/commands/approvals.ts) |
| <a id="fdekit-approvals-approve-id"></a>`fdekit approvals approve <id>` | Approve a queued approval request. | [packages/cli/src/commands/approvals.ts](../../packages/cli/src/commands/approvals.ts) |
| <a id="fdekit-approvals-reject-id"></a>`fdekit approvals reject <id>` | Reject a queued approval request. | [packages/cli/src/commands/approvals.ts](../../packages/cli/src/commands/approvals.ts) |
| <a id="fdekit-audit-limit-n"></a>`fdekit audit [--limit <n>]` | Show recent audit log entries. | [packages/cli/src/commands/audit.ts](../../packages/cli/src/commands/audit.ts) |
| <a id="fdekit-feedback-export-json"></a>`fdekit feedback export [--json]` | Export approval and audit feedback into eval candidates. | [packages/cli/src/commands/feedback.ts](../../packages/cli/src/commands/feedback.ts) |
| <a id="fdekit-trace"></a>`fdekit trace` | Generate a local HTML trace viewer. | [packages/cli/src/commands/trace.ts](../../packages/cli/src/commands/trace.ts) |
| <a id="fdekit-report"></a>`fdekit report` | Generate a deployment report. | [packages/cli/src/commands/report.ts](../../packages/cli/src/commands/report.ts) |
| <a id="fdekit-console"></a>`fdekit console` | Generate the static dashboard and export artifacts. | [packages/cli/src/commands/console.ts](../../packages/cli/src/commands/console.ts) |
| <a id="fdekit-env-start"></a>`fdekit env start` | Run configured environment start commands. | [packages/cli/src/commands/env.ts](../../packages/cli/src/commands/env.ts) |
| <a id="fdekit-env-seed"></a>`fdekit env seed` | Run configured environment seed commands. | [packages/cli/src/commands/env.ts](../../packages/cli/src/commands/env.ts) |
| <a id="fdekit-env-doctor"></a>`fdekit env doctor` | Run configured environment health checks. | [packages/cli/src/commands/env.ts](../../packages/cli/src/commands/env.ts) |
| <a id="fdekit-env-stop"></a>`fdekit env stop` | Run configured environment stop commands. | [packages/cli/src/commands/env.ts](../../packages/cli/src/commands/env.ts) |
| <a id="fdekit-env-describe"></a>`fdekit env describe` | Print configured environment metadata and evidence. | [packages/cli/src/commands/env.ts](../../packages/cli/src/commands/env.ts) |
| <a id="fdekit-help"></a>`fdekit help` | Print the CLI command map. | [packages/cli/src/catalog/docs.ts](../../packages/cli/src/catalog/docs.ts) |
