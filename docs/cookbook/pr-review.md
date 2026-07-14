# Review A Pull Request With The Codebase Agent

The codebase-agent recipe reviews pull requests with grounded, graded findings
and a human approval boundary. This entry walks the full loop: PR in, verified
findings out, humans decide.

## The pipeline

```txt
github.pr.diff (files, hunks, linked ticket refs)
  -> linear.issue.get / jira.issue.get   (intent check when a ticket is referenced)
  -> codebase.rankDiff                   (churn x import fan-in orders the review)
  -> codebase.readFile / usages / deps   (ground every finding in real code)
  -> findings JSON                       (the review findings contract)
  -> parseFindings                       (evidence REQUIRED; malformed rows dropped with reasons)
  -> verifyFindingLocations              (cited file/line must exist in the tree)
  -> grader (reviewJudge agent)          (scores correctness, impact, grounding; suppresses noise)
  -> artifacts/reviews/<runId>.json      (the persisted review artifact)
  -> github.review.post + slack.notify   (only surviving findings, only outside shadow mode)
```

Three defense layers keep hallucinated findings out of PR comments: the
contract gate (grounding must exist), the location gate (the cited location
must exist), and the judge (the grounding must hold up). The full contract is
in the [Review Findings Contract](../specs/review-findings-contract.md).

## Run it

```bash
fdekit recipe install codebase-agent
npm install

# Shadow (default): assess, grade, persist the artifact - post nothing.
npm run fdekit:codebase:review

# Advisory: post surviving findings as inline comments + notify reviewers in Slack.
node recipes/codebase-agent/review.mjs --pr 1 --mode advisory

# Request changes: escalates the recommendation when a high-severity finding survives.
node recipes/codebase-agent/review.mjs --pr 1 --mode request-changes
```

With the default `FDEKIT_CONNECTOR_MODE=local` everything is simulated
deterministically (a fixture PR, local posting), so the whole loop works
offline with the `mock` provider. For real pull requests:

```bash
FDEKIT_CONNECTOR_MODE=api \
GITHUB_TOKEN=ghp_your_token \
GITHUB_REPOSITORY=owner/repo \
SLACK_BOT_TOKEN=xoxb-your-token \
SLACK_CHANNEL_ID=C0123456789 \
CODEBASE_ROOT=/path/to/pr-head-checkout \
node recipes/codebase-agent/review.mjs --pr 123 --mode advisory
```

Check out the PR head branch locally first: location verification and risk
ranking read the working tree.

## The rules that always hold

- **The agent never approves.** `github.review.post` accepts `comment` and
  `request-changes` only; `approve` is rejected at the schema and in the
  handler. Humans approve on GitHub.
- **Evidence is required.** A finding that cites nothing is dropped before
  grading, with a field-named reason the model can repair against.
- **Repo content is data.** The injection eval suite
  (`evals/codebase-agent-review-injection.json`) verifies that instructions
  embedded in reviewed files are flagged as `security` findings and never
  executed - run it against any live provider before trusting it with real PRs.
- **Shadow before advisory.** Run shadow mode on real PRs, read
  `artifacts/reviews/*.json`, and only widen to advisory once precision holds.

## Rollout ladder

| Stage | Setting |
| --- | --- |
| Local demo | `mock` provider, local connector mode, fixture PR |
| Shadow on real PRs | `api` connector mode, `--mode shadow`: artifacts only |
| Advisory | `--mode advisory`: inline comments + Slack card, humans decide |
| Request changes | `--mode request-changes`: recommendation may escalate |

## Model requirements

The review flow is multi-step tool use plus a strict JSON output contract.
Use a tool-use-reliable model (`fdekit doctor` reports provider readiness);
small local models reliably fail the flow. The judge agent (`reviewJudge`)
runs once per finding - budget accordingly on live providers.

## Next step

Point `CODEBASE_ROOT` at a customer repository, run the eval suites
(`npm run fdekit:codebase:eval`), and capture the working deployment as a
recipe for reuse (`fdekit recipe capture`).
