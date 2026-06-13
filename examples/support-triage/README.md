# Support Triage Example

This example acts like a small customer environment for an FDEKit deployment. It includes:

- A lightweight customer API with customers, subscriptions, tickets, escalations, issue creation, and Slack-like messages.
- A FDEKit deployment config wired through reusable connector packages.
- A support triage agent prompt and smoke eval dataset.

The deployment uses:

- `@fdekit/connector-customer-api` for `customer.get`, `ticket.get`, and `ticket.escalate`.
- `@fdekit/connector-github` in local mode for `issue.create`, or API mode for real GitHub issues.
- `@fdekit/connector-slack` in local mode for `slack.message`, or API mode for real Slack messages.
- The deterministic `mock` provider for a credential-free agent loop.
- Policy-as-code for approval gates, permission scopes, environment separation, secret/PII checks, and budget caps.
- A workflow scorecard and rollout plan encoded in `fde.config.ts`.

From the repo root, run the full launch demo with:

```bash
npm run demo
```

From this example directory, run the same local recipe demo with:

```bash
npm run demo
```

That script starts the local customer API on `127.0.0.1:8787`, waits for `/health`, runs the governed loop, generates the console, captures `support-renewal-risk`, and shuts the API down.

To debug this fixture one stage at a time, run the API:

```bash
npm run example:api
```

In another terminal, run the deployment workflow:

```bash
npm run example:doctor
npm run example:validate
npm run example:run
npm run example:approvals
npm run example:audit
npm run example:feedback
npm run example:eval
npm run example:macro
npm run example:report
npm run example:console
```

The API listens on `http://127.0.0.1:8787` by default. Set `CUSTOMER_API_URL` in the FDEKit config environment to point at a different URL.

## Use A Customer-Owned API

The bundled customer API is only the first rung of the recipe. In a real project, keep the agent, policies, evals, traces, and console, then adapt the `customerApi` connector in `fde.config.ts`.

For APIs that already match the recipe shape, only change the base URL:

```ts
const customerApi = customerApiConnector({
  baseUrl: process.env.CUSTOMER_API_URL,
});
```

For APIs with different routes or response fields, override the route builders and map the customer-specific payloads into the shape your agent expects:

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

The `example:run` command executes the `supportTriage` agent with the deterministic `mock` provider. It calls the configured connector tools, applies policies, writes a trace, and returns a final triage summary. Real OpenAI, Anthropic, Google Gemini, and local Ollama adapters sit behind the same runtime provider boundary.

The `example:eval` command runs each case in `evals/support-triage.json` through that same loop. The eval runner grades expected escalation behavior, required base tool calls, policy violations, latency, and cost, then writes per-case run traces plus `.fdekit/evals/latest.json`.

The `example:console` command writes `.fdekit/console.html`, a local command-center dashboard with deployment health signals, connector evidence, policy-as-code, budget caps, approval queue, audit log, eval comparison, created issue, Slack notification, eval status, cost/latency, trace timeline, connector tool activity, governance checks, run history, and report preview. It preserves timestamped snapshots in `.fdekit/consoles/`, writes `.csv` and `.md` export artifacts in `.fdekit/exports/`, and includes a print-to-PDF button.

To prove the external connector path with real Slack and GitHub calls, set API mode and credentials:

```bash
FDEKIT_CONNECTOR_MODE=api \
GITHUB_TOKEN=ghp_your_token \
GITHUB_REPOSITORY=owner/repo \
SLACK_BOT_TOKEN=xoxb-your-token \
SLACK_CHANNEL_ID=C0123456789 \
npm run example:run
```

Keep `FDEKIT_CONNECTOR_MODE` unset for the default credential-free local demo.

Run `npm run example:doctor` before switching to API mode. It reports which provider and connector env vars are set or missing without printing secret values.
