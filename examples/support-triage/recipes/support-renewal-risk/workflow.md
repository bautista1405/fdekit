# Support triage escalation

## Owner

support-ops

## Current Workflow

Support manually gathers customer, subscription, and ticket context before escalating renewal-risk issues

## Target Workflow

The agent gathers context, creates the engineering issue, notifies Slack, and moves the ticket into escalation with approval evidence

Target: <30m triage for P1/P2 enterprise renewal-risk tickets

## Outcome Metrics

- triage-cycle-time: 4h median -> <30m for P1/P2
- sla-breach-risk: manual escalation review -> all renewal-risk tickets routed with evidence

## Rollout

- Current stage: local
- Next step: Point CUSTOMER_API_URL at a customer-owned support API sample and keep external writes approval-gated
