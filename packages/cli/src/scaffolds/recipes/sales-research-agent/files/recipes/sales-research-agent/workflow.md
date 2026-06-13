# Sales Research Workflow

This recipe is useful when sales teams repeatedly collect account, contact, and intent context before updating CRM and planning outreach.

## Current Workflow

- Manual steps: identify account, inspect CRM, find contacts, read intent signals, draft angle, write CRM note.
- Handoffs: account executive -> sales engineering -> revenue operations.
- Systems of record: CRM account/contact records and intent signal sources.
- Recurring exceptions: stale contacts, missing buying signals, unclear recommended angle, inconsistent CRM notes.
- Baseline metric: 45m manual account research.

## Target Workflow

- Deterministic automation: dataset/CRM lookup, contact filtering, CRM note payload mapping, redaction.
- Agent judgment: synthesize buyer context, choose the best angle, draft the recommended next step.
- Human judgment: approve high-impact CRM writes and own account strategy.
- First improvement target: <10m account brief with CRM note and next action.

## Scorecard

| Signal | Rating | Notes |
| --- | --- | --- |
| Volume | high | Sales teams research many accounts and opportunities. |
| Manual effort | high | Humans jump between CRM, signals, notes, and internal context. |
| Fragmented systems | high | CRM exports, HubSpot/Salesforce, contacts, and intent signals. |
| Repeatable decisions | high | Research briefs need consistent contacts, pains, angle, and next step. |
| Measurable pain | high | Research time, CRM hygiene, and follow-up delay can be tracked. |
| Risk boundary | high | CRM writes are customer-visible business records and should be approval-gated first. |

## Data Layers

- System of record: CRM account and contact records.
- Business rules: agent instructions, governance policies, sales qualification rules, and eval assertions.
- Raw intake: account id, persona, CRM export rows, and intent signals.
- Feedback and memory: approved/rejected notes, audit logs, AE corrections, and future eval cases.

## Rollout

1. Local demo with bundled sales dataset and local CRM note mode.
2. Sandbox with customer-shaped CRM export.
3. Customer sample with CRM writes disabled or local-only.
4. Shadow mode against real CRM records.
5. Human-approved CRM note creation.
6. Production allowlist for selected teams, account segments, or CRM objects.
