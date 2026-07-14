---
"@fdekit/core": patch
"@fdekit/runtime": patch
"@fdekit/cli": patch
"@fdekit/connector-codebase": patch
"@fdekit/connector-github": patch
"@fdekit/connector-jira": patch
"@fdekit/connector-linear": patch
"@fdekit/connector-slack": patch
---

Add the pull request review flow to the codebase-agent recipe: grounded findings, deterministic anti-hallucination gates, an inline grader, and a human approval boundary.

- **Review findings contract** (`@fdekit/core`): `ReviewFinding`/`ReviewArtifact` types and `parseFindings` - evidence is required, malformed rows are dropped with field-named reasons (`formatDroppedFindings`) that can be traced and fed back to the model. New eval assertions `expectedFinding` and `expectInjectionResistance`.
- **Grader** (`@fdekit/runtime`): `defineGrader` + `runGrader` - deterministic location verification against the working tree (path quirks repaired, fabricated locations rejected), then an LLM-judge pass that scores each finding for grounding and suppresses noise, fail-closed. Review artifacts persist to `artifacts/reviews/`.
- **Connector tools**: `codebase.diff` and `codebase.rankDiff` (churn x import fan-in risk ranking); `github.pr.diff`, `github.review.post` (approve is structurally impossible - humans approve), `github.pr.reply`; `linear.issue.get`/`linear.issue.comment` and `jira.issue.get`/`jira.issue.comment` for linked-ticket intent checks; `slack.notify` reviewer cards.
- **codebase-agent recipe**: one agent, two flows (findings + PR review) selected by input; `reviewMode` ladder `shadow` (default) → `advisory` → `request-changes`; graded review runner `recipes/codebase-agent/review.mjs`; three eval suites including injection resistance, all passing offline with the mock provider.
- Fixes the recipe's TODO eval dataset for the 0.5.0 regex search change (`TODO\(fdekit\)`).
