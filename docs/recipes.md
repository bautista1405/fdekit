# Recipes

Recipes are reusable field-deployment patterns. They install agents, eval datasets, local sample systems, package scripts, `.env.example` entries, and a recipe-shaped `fde.config.ts`.

Start with a recipe when you want a complete runnable deployment. Use `fdekit add` when you already have a deployment and only need to add one provider, connector, eval, or policy.

## Install A Recipe

```bash
npm install -D @fdekit/cli
npx fdekit init
cd fdekit
npm install
npx fdekit recipe install <name>
cp .env.example .env
```

Recipe installation uses the discovered FDEKit project. From an uninitialized customer root, it creates and writes into `./fdekit`; relative local-recipe paths remain relative to the directory where the command was invoked.

Available built-ins:

| Recipe | Proves | Local default | Live path |
| --- | --- | --- | --- |
| `support-triage` | Customer API lookup, escalation, Slack notification, issue creation, approval evidence, report | Local customer API, local Slack-style message, local GitHub-style issue | Slack API and GitHub API |
| `codebase-agent` | Search/read a customer repo, create an engineering issue, run codebase evals | Local sample repo and local issue creation | GitHub, Jira, or Linear |
| `sales-research-agent` | Research an account, gather buyer context, create a CRM note | Local CRM/research dataset and local CRM note | HubSpot or Salesforce |
| `load-test-agent` | Run governed load tests from the agent runtime and capture threshold evidence | Deterministic local load-test result | Local k6 CLI against a customer API |

## Config Contract Vs Narrative

Recipe configs intentionally mix executable deployment contract with field-method context. Treat these differently when reading or editing `fde.config.ts`:

| Config area | Runtime meaning |
| --- | --- |
| `providers`, `connectors`, connector tools, `agents`, `governance`, `policies`, `evals`, `harness`, `artifacts`, and env requirements | Load-bearing. Runtime, validation, strict mode, evals, reports, and artifact routing use these fields directly. |
| `workflow.currentState`, `workflow.targetState`, `workflow.scorecard`, `outcomeMetrics`, `dataLayers`, `rollout`, and migration notes | Reporting and handoff context. They feed console pages, reports, recipe docs, and stakeholder review. Validation checks their declared structure, but FDEKit does not verify that the business narrative is true. |

This matters most in larger examples such as `sales-research-agent`, where the config carries CRM connector setup and local demo tools alongside business narrative like manual baseline, outcome targets, and data-layer ownership. Edit the load-bearing fields when changing what runs; edit the narrative fields when changing what the deployment explains to reviewers.

## Support Triage

From this repository, run the full launch demo with:

```bash
npm run demo
```

For an installed support-triage project, or when debugging one stage at a time:

```bash
npx fdekit recipe install support-triage
npm install
npm run demo
```

The installed demo script starts the local customer API on `127.0.0.1:8787`, waits for health, runs the governed loop, generates the console, captures `support-renewal-risk`, and shuts the API down.

To step through the same loop manually:

```bash
npm run api
```

In another terminal:

```bash
npm run fdekit:doctor
npm run fdekit:validate
npm run fdekit:run
npm run fdekit:feedback
npm run fdekit:eval
npm run fdekit:macro
npm run fdekit:report
npm run fdekit:console
```

Live Slack/GitHub mode:

```bash
FDEKIT_CONNECTOR_MODE=api
GITHUB_TOKEN=ghp_your_token
GITHUB_REPOSITORY=owner/repo
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_CHANNEL_ID=C0123456789
```

## Codebase Agent

```bash
npx fdekit recipe install codebase-agent
npm install
npm run fdekit:codebase:doctor
npm run fdekit:codebase:run
npm run fdekit:codebase:feedback
npm run fdekit:codebase:eval
npm run fdekit:codebase:console
```

Use a real customer repository:

```bash
CODEBASE_ROOT=/path/to/customer/repo npm run fdekit:codebase:run
```

Create real issues:

```bash
FDEKIT_ISSUE_TRACKER=github \
FDEKIT_CONNECTOR_MODE=api \
GITHUB_TOKEN=ghp_your_token \
GITHUB_REPOSITORY=owner/repo \
npm run fdekit:codebase:run
```

Jira uses `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_PROJECT_KEY`. Linear uses `LINEAR_API_KEY` and `LINEAR_TEAM_ID`.

## Sales Research Agent

```bash
npx fdekit recipe install sales-research-agent
npm install
npm run fdekit:sales:doctor
npm run fdekit:sales:run
npm run fdekit:sales:feedback
npm run fdekit:sales:eval
npm run fdekit:sales:console
```

Use a real CRM backend:

```bash
FDEKIT_CRM=hubspot \
FDEKIT_CONNECTOR_MODE=api \
HUBSPOT_ACCESS_TOKEN=pat_xxx \
npm run fdekit:sales:run
```

```bash
FDEKIT_CRM=salesforce \
FDEKIT_CONNECTOR_MODE=api \
SALESFORCE_INSTANCE_URL=https://your-domain.my.salesforce.com \
SALESFORCE_ACCESS_TOKEN=00D... \
npm run fdekit:sales:run
```

## Load-Test Agent

```bash
npx fdekit recipe install load-test-agent
npm install
npm run loadtest:api
npm run fdekit:loadtest:doctor
npm run fdekit:loadtest:run
npm run fdekit:loadtest:feedback
npm run fdekit:loadtest:eval
npm run fdekit:loadtest:console
```

The load-test recipe starts in deterministic local mode. To run actual Grafana k6 tests, install the k6 CLI separately and set:

```bash
FDEKIT_LOAD_TEST_MODE=k6
K6_SCRIPT=./load-tests/customer-api-smoke.js
LOAD_TEST_TARGET_URL=http://localhost:8000
```

Keep `K6_BINARY` unset when `k6` is already on `PATH`.

## Capture A Local Recipe

After customizing a deployment, capture it for reuse:

```bash
npx fdekit recipe capture renewal-risk-triage
```

That writes `recipes/renewal-risk-triage/` with config, agents, evals, workflow docs, env example, package metadata, and deployment snapshot. Install it again with:

```bash
npx fdekit recipe install /path/to/recipes/renewal-risk-triage
```

## Next Step

If you just finished a recipe run, read the [CLI Reference](./cli-reference.md) to understand the command loop, then use [Reference Architectures](./reference-architectures.md) to decide whether your next run should stay local, turn on live connectors, or move toward production-shaped governance.
