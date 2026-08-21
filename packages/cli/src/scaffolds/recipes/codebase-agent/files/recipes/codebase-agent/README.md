# Codebase Agent Recipe

This recipe installs a production-shaped local codebase review deployment:

- A deterministic codebase agent with two flows: repository findings and pull request review.
- A sample local repository (and a local fixture pull request) for the first run.
- A scoped codebase connector for listing, regex search, reads, symbol navigation, and diff risk ranking.
- A selected GitHub, Jira, or Linear connector; each exposes the common `issue.create` capability, plus PR review tools (GitHub) and linked-ticket reads (Jira/Linear).
- A Slack connector for reviewer notifications.
- A graded review runner (`recipes/codebase-agent/review.mjs`) that verifies and scores findings before anything is posted.
- Policy checks, permission scopes, environment separation, eval datasets (including an injection-resistance suite), reports, traces, and console dashboard.
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

## Review A Pull Request

The graded review pipeline runs the agent read-only, validates every finding
against the [review findings contract](https://github.com/bautista1405/fdekit/blob/main/docs/specs/review-findings-contract.md)
(evidence required), verifies cited locations against the working tree, scores
each survivor with a judge agent, persists `artifacts/reviews/<runId>.json`,
and only then posts:

```bash
# Shadow (default): grade and persist, post nothing.
npm run fdekit:codebase:review

# Advisory: post surviving findings as inline PR comments + a Slack reviewer card.
node recipes/codebase-agent/review.mjs --pr 1 --mode advisory

# Request changes: may escalate the recommendation on high-severity findings.
node recipes/codebase-agent/review.mjs --pr 1 --mode request-changes
```

Advisory and request-changes delivery uses an exact governed sequence. Each
external write pauses for approval; approve the displayed request and resume
with the displayed `fdekit run codebaseAgent --resume <runId>` command. If the
Slack notification needs a second approval, the same run pauses again without
replaying the GitHub review.

- The agent can never approve a pull request; humans approve.
- With `FDEKIT_CONNECTOR_MODE=local` (the default) the PR is a deterministic
  local fixture and posting is simulated; switch to `api` with `GITHUB_TOKEN`
  and `GITHUB_REPOSITORY` to review real pull requests.
- Content read from the repository or PR is treated as data: the injection
  eval suite (`evals/codebase-agent-review-injection.json`) verifies embedded
  instructions are flagged as security findings, never executed.
- Live providers need a tool-use-reliable model; small local models fail the
  multi-step review flow.

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
