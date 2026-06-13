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

The demo script starts the local customer API on `127.0.0.1:8787`, waits for `/health`, runs the governed loop, generates the console, captures `support-renewal-risk`, and shuts the API down.

## Step Through Locally

```bash
npm run api
```

In another terminal:

```bash
npm run fdekit:doctor
npm run fdekit:validate
npm run fdekit:run
npm run fdekit:approvals
npm run fdekit:audit
npm run fdekit:feedback
npm run fdekit:eval
npm run fdekit:macro
npm run fdekit:report
npm run fdekit:console
```

## Use Real Slack And GitHub

The recipe defaults to local connector mode; to prove the external connector path:

```bash
FDEKIT_CONNECTOR_MODE=api \
GITHUB_TOKEN=ghp_your_token \
GITHUB_REPOSITORY=owner/repo \
SLACK_BOT_TOKEN=xoxb-your-token \
SLACK_CHANNEL_ID=C0123456789 \
npm run fdekit:run
```

Run `npm run fdekit:doctor` first to check required env vars without printing secret values.

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
