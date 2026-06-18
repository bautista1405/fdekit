# Codebase Agent Recipe

This recipe installs a production-shaped local codebase review deployment:

- A deterministic codebase agent.
- A sample local repository for the first run.
- A scoped codebase connector for file listing, search, and reads.
- A selected GitHub, Jira, or Linear connector; each exposes the common `issue.create` capability for the agent.
- Policy checks, permission scopes, environment separation, eval dataset, reports, traces, and console dashboard.
- A workflow scorecard and rollout plan in `recipes/codebase-agent/workflow.md`.

## Run Locally

```bash
cp .env.example .env
npm run fdekit:codebase:doctor
npm run fdekit:codebase:run
npm run fdekit:codebase:approvals
npm run fdekit:codebase:audit
npm run fdekit:codebase:feedback
npm run fdekit:codebase:eval
npm run fdekit:codebase:macro
npm run fdekit:codebase:report
npm run fdekit:codebase:console
```

The config reads `.env` automatically; choose `FDEKIT_PROVIDER=mock`, `localOllama`, `openai`, `anthropic`, or `google` per customer environment; set `FDEKIT_MODEL` only when you want to override the selected provider's default model.

## Use A Customer Codebase

The bundled `sample-repo` is only the first rung. When FDEKit lives in the default `./fdekit` folder, inspect the containing customer project with:

```bash
CODEBASE_ROOT=.. npm run fdekit:codebase:run
```

For a standalone FDEKit checkout, use `CODEBASE_ROOT=.` instead.

To run against another local checkout:

```bash
CODEBASE_ROOT=/path/to/customer/repo npm run fdekit:codebase:run
```

If this recipe preserved an existing `fde.config.ts`, copy the `codebaseConnector()`, selected issue connector, `codebaseAgent`, and eval block from `recipes/codebase-agent/fde.config.ts` into your custom config.

## Use A Customer Issue Tracker

The recipe defaults to local GitHub-shaped issue results; to create issues in the customer's tracker, choose a backing system and switch to API mode:

```bash
FDEKIT_ISSUE_TRACKER=github \
FDEKIT_CONNECTOR_MODE=api \
GITHUB_TOKEN=ghp_your_token \
GITHUB_REPOSITORY=owner/repo \
CODEBASE_ROOT=/path/to/customer/repo \
npm run fdekit:codebase:run
```

For Jira, set `FDEKIT_ISSUE_TRACKER=jira` plus `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_PROJECT_KEY`.

For Linear, set `FDEKIT_ISSUE_TRACKER=linear` plus `LINEAR_API_KEY` and `LINEAR_TEAM_ID`.

Run `npm run fdekit:codebase:doctor` first to check required env vars without printing secret values.
