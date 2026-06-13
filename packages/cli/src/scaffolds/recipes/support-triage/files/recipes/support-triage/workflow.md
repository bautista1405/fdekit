# Support Triage Workflow

This recipe is useful when a support team repeatedly escalates customer issues across tickets, account data, Slack, and an issue tracker.

## Current Workflow

- Manual steps: read ticket, inspect customer tier/subscription, decide severity, create issue, notify Slack, update escalation status.
- Handoffs: support -> engineering -> customer-success.
- Systems of record: customer API/ticketing system, issue tracker, Slack.
- Recurring exceptions: billing blockers, renewal risk, production availability, unclear engineering owner.
- Baseline metric: 4h median triage for high-priority enterprise tickets.

## Target Workflow

- Deterministic automation: API route mapping, connector calls, redaction, policy checks, report/export writing.
- Agent judgment: summarize the case, decide whether escalation is appropriate, draft issue and Slack handoff.
- Human judgment: approve issue creation, Slack notification, and production ticket escalation.
- First improvement target: <30m triage for P1/P2 enterprise renewal-risk tickets.

## Scorecard

| Signal | Rating | Notes |
| --- | --- | --- |
| Volume | high | Support teams handle repeated ticket triage every day. |
| Manual effort | high | Humans search between tickets, customer records, Slack, and issue tracker. |
| Fragmented systems | high | Customer API/tickets, issue tracker, and Slack. |
| Repeatable decisions | high | Escalation rules depend on tier, priority, renewal, billing, and availability. |
| Measurable pain | high | Cycle time, SLA breach risk, and handoff quality can be tracked. |
| Risk boundary | high | External writes require approval until the customer accepts the rollout. |

## Data Layers

- System of record: customer API tickets, subscriptions, and issue tracker.
- Business rules: agent instructions, governance policies, and eval assertions.
- Raw intake: ticket body, priority, tags, customer tier, subscription status.
- Feedback and memory: approvals, rejects, corrections, audit logs, and future eval cases.

## Rollout

1. Local demo with bundled API and local Slack/GitHub modes.
2. Sandbox with customer-shaped tickets and accounts.
3. Customer sample with writes disabled or local-only.
4. Shadow mode against real ticket data.
5. Human-approved issue/Slack/ticket writes.
6. Production allowlist for specific queues, channels, and repos.
