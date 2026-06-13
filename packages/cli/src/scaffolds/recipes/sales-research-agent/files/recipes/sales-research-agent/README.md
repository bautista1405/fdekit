# Sales Research Agent Recipe

This recipe installs a production-shaped local sales research deployment:

- A deterministic sales research agent.
- A local CRM/research export under `sales-data/prospects.json`.
- Account lookup, contact discovery, buying-signal lookup, and CRM note tools.
- A laddered CRM backend: local first, then HubSpot or Salesforce API mode.
- Provider selection through `FDEKIT_PROVIDER` plus optional `FDEKIT_MODEL`.
- Policy checks, permission scopes, environment separation, eval dataset, reports, traces, and console dashboard.
- A workflow scorecard and rollout plan in `recipes/sales-research-agent/workflow.md`.

## Run Locally

```bash
cp .env.example .env
npm run fdekit:sales:doctor
npm run fdekit:sales:run
npm run fdekit:sales:audit
npm run fdekit:sales:feedback
npm run fdekit:sales:eval
npm run fdekit:sales:macro
npm run fdekit:sales:report
npm run fdekit:sales:console
```

The first run is credential-free with `FDEKIT_PROVIDER=mock`; to run against a local model:

```bash
FDEKIT_PROVIDER=localOllama FDEKIT_MODEL=hermes3:8b npm run fdekit:sales:run
```

## Use Customer CRM Data

The bundled dataset is the first rung; export a small account/contact/signal sample from the customer's CRM or warehouse, match the JSON shape in `sales-data/prospects.json`, then point the recipe at it:

```bash
SALES_RESEARCH_DATASET=/path/to/customer-sales-export.json npm run fdekit:sales:run
```

For a direct CRM integration, keep the agent, policies, and evals, then replace the `salesResearch` connector handlers in `fde.config.ts` with API-backed calls.

## Use HubSpot or Salesforce

Keep the stable agent tool `crm.note.create` and switch only the CRM backend:

```bash
FDEKIT_CRM=hubspot FDEKIT_CONNECTOR_MODE=api HUBSPOT_ACCESS_TOKEN=pat_xxx npm run fdekit:sales:run
FDEKIT_CRM=salesforce FDEKIT_CONNECTOR_MODE=api SALESFORCE_INSTANCE_URL=https://your-domain.my.salesforce.com SALESFORCE_ACCESS_TOKEN=00D... npm run fdekit:sales:run
```

Advanced users can call the native tools directly: `hubspot.note.create` or `salesforce.task.create`.
