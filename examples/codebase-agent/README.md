# Codebase Agent Example

This example acts like a local customer repository for an FDEKit deployment. It includes:

- A tiny sample codebase under `sample-repo/`.
- A codebase connector for scoped file listing, search, and reads.
- A selected GitHub, Jira, or Linear connector. Each exposes the common `issue.create` capability for the agent.
- A deterministic codebase agent loop and smoke eval dataset.
- Policy-as-code for permission scopes, environment separation, secret/PII checks, and budget caps.
- A workflow scorecard and rollout plan encoded in `fde.config.ts`.

Run the workflow:

```bash
cp .env.example .env
npm run demo
```

Or run the same loop step by step:

```bash
npm run example:codebase:doctor
npm run example:codebase:dev
npm run example:codebase:run
npm run example:codebase:approvals
npm run example:codebase:audit
npm run example:codebase:feedback
npm run example:codebase:eval
npm run example:codebase:macro
npm run example:codebase:report
npm run example:codebase:console
```

The default run searches for `TODO(fdekit)` in `sample-repo`, reads the matching source file, creates a local issue-tracker result, writes traces, and produces a final handoff. Run the console command after a run to see deployment health signals, connector evidence, the created issue, policy-as-code, budget caps, approval queue, audit log, eval comparison, cost/latency, charts, and run history in `artifacts/console.html`; each console generation preserves a timestamped snapshot in `artifacts/consoles/`, writes `.csv` and `.md` export artifacts in `artifacts/exports/`, and includes a print-to-PDF button.

The config reads `.env` automatically. Choose the provider per customer/developer environment:

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

To point the example at a real local repository:

```bash
CODEBASE_ROOT=/path/to/customer/repo npm run example:codebase:run
```

To create issues in the customer's tracker, choose a backing system and switch to API mode:

```bash
FDEKIT_ISSUE_TRACKER=github \
FDEKIT_CONNECTOR_MODE=api \
GITHUB_TOKEN=ghp_your_token \
GITHUB_REPOSITORY=owner/repo \
CODEBASE_ROOT=/path/to/customer/repo \
npm run example:codebase:run
```

For Jira, set `FDEKIT_ISSUE_TRACKER=jira` plus `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_PROJECT_KEY`. For Linear, set `FDEKIT_ISSUE_TRACKER=linear` plus `LINEAR_API_KEY` and `LINEAR_TEAM_ID`.

Run `npm run example:codebase:doctor` first to confirm env setup without printing secret values.
