# Sales Research Agent Example

This example acts like a local CRM and account research workspace for an FDEKit deployment. It includes:

- A sample account/contact/intent dataset under `sales-data/`.
- Account lookup, contact discovery, intent lookup, and a laddered CRM note tool.
- Local CRM notes by default, with HubSpot and Salesforce API mode available through env.
- A deterministic sales research agent loop and smoke eval dataset.
- Policy-as-code for permission scopes, environment separation, secret/PII checks, and budget caps.
- A workflow scorecard and rollout plan encoded in `fde.config.ts`.

Run the workflow:

```bash
cp .env.example .env
npm run demo
```

Or run the same loop step by step:

```bash
npm run example:sales:doctor
npm run example:sales:dev
npm run example:sales:run
npm run example:sales:audit
npm run example:sales:feedback
npm run example:sales:eval
npm run example:sales:macro
npm run example:sales:report
npm run example:sales:console
```

The default run researches `acct_company`, finds buyer context, gathers intent signals, creates a local CRM note result, writes traces, and produces a final account handoff. Run the console command after a run to inspect tool calls, policy-as-code, budget caps, audit evidence, eval status, charts, and run history in `artifacts/console.html`.

The config reads `.env` automatically:

```bash
# Deterministic demo provider
FDEKIT_PROVIDER=mock

# Local Ollama
FDEKIT_PROVIDER=localOllama
FDEKIT_MODEL=hermes3:8b

# OpenAI
FDEKIT_PROVIDER=openai
OPENAI_API_KEY=...

# Anthropic
FDEKIT_PROVIDER=anthropic
ANTHROPIC_API_KEY=...

# Google Gemini
FDEKIT_PROVIDER=google
GEMINI_API_KEY=...
```

To point the example at a customer CRM export:

```bash
SALES_RESEARCH_DATASET=/path/to/customer-sales-export.json npm run example:sales:run
```

To write the final `crm.note.create` handoff into a real CRM, keep the same agent and switch only the CRM backend:

```bash
FDEKIT_CRM=hubspot FDEKIT_CONNECTOR_MODE=api HUBSPOT_ACCESS_TOKEN=pat_xxx npm run example:sales:run
FDEKIT_CRM=salesforce FDEKIT_CONNECTOR_MODE=api SALESFORCE_INSTANCE_URL=https://your-domain.my.salesforce.com SALESFORCE_ACCESS_TOKEN=00D... npm run example:sales:run
```

Advanced users can call the native CRM tools directly: `hubspot.note.create` or `salesforce.task.create`.
