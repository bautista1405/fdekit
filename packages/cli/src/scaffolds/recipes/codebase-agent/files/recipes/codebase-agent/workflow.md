# Codebase Agent Workflow

This recipe is useful when FDEs repeatedly inspect customer repositories for production-readiness gaps and need a governed issue handoff.

## Current Workflow

- Manual steps: identify signal, search repo, inspect files, summarize risk, create issue, attach evidence.
- Handoffs: forward-deployed engineer -> customer engineering -> platform owner.
- Systems of record: customer repository and issue tracker.
- Recurring exceptions: unclear file ownership, missing evidence, duplicate issues, noisy TODOs.
- Baseline metric: 1h targeted manual review for a concrete finding.

## Target Workflow

- Deterministic automation: repository search, file reads, path normalization, issue payload mapping.
- Agent judgment: choose relevant files, summarize risk, decide whether an issue is justified.
- Human judgment: approve issue creation and customer-facing engineering handoff.
- First improvement target: <15m from requested signal to issue-ready handoff.

## Scorecard

| Signal | Rating | Notes |
| --- | --- | --- |
| Volume | medium | Codebase review happens during onboarding, incidents, audits, and roadmap work. |
| Manual effort | high | Engineers spend time searching, reading, and writing repeatable handoff notes. |
| Fragmented systems | medium | Repo plus issue tracker, often with separate deployment/eval evidence. |
| Repeatable decisions | medium | Good issues need evidence, impact, owner, and next action. |
| Measurable pain | medium | Review cycle time, issue quality, and missed gaps can be tracked. |
| Risk boundary | high | Reads are low-risk; tracker writes should be approval-gated until accepted. |

## Data Layers

- System of record: customer repository and issue tracker.
- Business rules: agent instructions, governance policies, and eval assertions.
- Raw intake: task input, search hits, file contents, and issue payload.
- Feedback and memory: approvals, rejections, audit logs, duplicate issue review, and future eval cases.

## Rollout

1. Local demo with bundled sample repo and local issue mode.
2. Sandbox with a customer-like repository fixture.
3. Customer sample with writes disabled or local-only.
4. Shadow review against a real repository.
5. Human-approved issue creation.
6. Production allowlist for selected repos, teams, or issue projects.
