# Support Triage Recipe

This recipe installs a production-shaped local support triage deployment:

- A deterministic support triage agent.
- A local customer API with customers, tickets, escalations, issues, and Slack-style messages.
- Customer API, GitHub, and Slack connector packages.
- Policy checks, permission scopes, environment separation, eval dataset, reports, traces, and console dashboard.
- A workflow scorecard and rollout plan in `recipes/support-triage/workflow.md`.

## Run Locally

```bash
npm run demo
```

The demo script starts the local customer API on `127.0.0.1:8787`, waits for `/health`, runs the governed loop including one full human-approval walkthrough (pause, approve, resume), generates the console, captures `support-renewal-risk`, and shuts the API down.

## Step Through Locally

```bash
npm run api
```

In another terminal (each command also has an npm script; run `npm run` to list the names in your project):

```bash
fdekit doctor
fdekit validate
fdekit run supportTriage --ticket tick_1001
fdekit approvals list
fdekit audit
fdekit feedback export
fdekit eval run supportTriage
fdekit eval macro
fdekit report
fdekit console
```

## Human Review Loop

External writes (`issue.create`, `slack.message`, `ticket.escalate`) are approval-gated by the `require-approval` policy in `fde.config.ts`. A gated run pauses with `Status: waiting_approval` and exit code 2:

```bash
fdekit run supportTriage --ticket tick_1001   # pauses on the first gated write
fdekit approvals list --status pending        # see what is waiting (args included)
fdekit approvals show <id>                    # inspect the full request
fdekit approvals approve <id> --by <you> --reason "why"
fdekit run supportTriage --resume             # executes the approved call and continues
```

`--resume` continues the paused run: it executes exactly the approved tool call (no re-planning, so live providers cannot drift the approved args) and does not replay earlier writes. Repeat approve/resume until the run completes. Rejecting a request ends the run with `Status: rejected`.

Approvals are scoped to the execution target (connector mode, repository, channel). Approvals granted in local/simulated mode do not carry over to `FDEKIT_CONNECTOR_MODE=api`; the first live run asks for fresh review.

Eval runs auto-decide approval gates (recording each decision as `eval-runner`), so `npm run fdekit:eval` works with gating enabled. Pass `--require-approvals` to `fdekit eval run` to keep production pause behavior instead.

## Use Real Slack And GitHub

The recipe defaults to local connector mode; to prove the external connector path:

```bash
FDEKIT_CONNECTOR_MODE=api \
GITHUB_TOKEN=ghp_your_token \
GITHUB_REPOSITORY=owner/repo \
SLACK_BOT_TOKEN=xoxb-your-token \
SLACK_CHANNEL_ID=C0123456789 \
fdekit run supportTriage --ticket tick_1001
```

Run `fdekit doctor` first to check required env vars without printing secret values. Approvals granted while connectors were in local mode do not apply here: the approval fingerprint includes the connector mode and target, so the first API-mode run pauses for fresh review before any real write.

## Use Your Customer API

The bundled API is a runnable example; for a customer-owned system, keep the recipe and adapt the `customerApi` connector in `fde.config.ts`.

If the API already exposes compatible customers and tickets, point the connector at it:

```ts
const customerApi = customerApiConnector({
  baseUrl: process.env.CUSTOMER_API_URL,
});
```

If the API has different routes or field names, override only those pieces:

```ts
const customerApi = customerApiConnector({
  baseUrl: process.env.CUSTOMER_API_URL,
  routes: {
    getCustomer: ({ customerId }) => `/v1/accounts/${customerId}`,
    getTicket: ({ ticketId }) => `/v1/cases/${ticketId}?include=account`,
    escalateTicket: ({ ticketId }) => `/v1/cases/${ticketId}/escalations`,
  },
  mapCustomer: (raw) => ({
    id: raw.account_id,
    name: raw.company_name,
    tier: raw.plan_tier,
  }),
  mapTicket: (raw) => ({
    id: raw.case_id,
    customerId: raw.account_id,
    title: raw.subject,
    body: raw.description,
    priority: raw.severity,
    tags: raw.labels,
  }),
  escalationBody: ({ reason, channel }) => ({
    note: reason,
    notifyChannel: channel,
  }),
});
```
