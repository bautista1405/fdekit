# Field Deployment Method

FDEKit should help an FDE move from "agent demo" to "customer operating layer." The product should make the hard parts visible: workflow discovery, system integration, governance, rollout stages, measurable outcomes, and the handoff evidence a customer needs to trust the deployment.

This doc translates enterprise agent deployment patterns into concrete FDEKit product rules. The central lesson: AI transformation is not a SaaS swap. It is operational redesign around where AI, deterministic automation, and humans each do their best work.

## Core Idea

Do not optimize for single-task automation. Optimize for repeatable operating workflows.

A useful FDEKit recipe should show how work moves across people, systems, policies, and evidence:

```txt
intake -> context gathering -> decision -> governed action -> handoff -> reporting -> eval/audit evidence
```

That means recipes are not just prompts and tools. They are field deployment packages:

- the customer workflow being changed,
- the systems the workflow touches,
- the approval and permission model,
- the evals that prove behavior,
- the metrics that explain value,
- the rollout path from local demo to production,
- and the artifacts that let engineers and stakeholders review what happened.

## Design Principles

### Start With Workflow Discovery

Every serious deployment should start by mapping the current workflow before writing agent logic.

Capture:

- current manual steps,
- handoffs between teams,
- systems of record,
- recurring exception types,
- current cycle time and idle time,
- owner for each decision,
- failure modes,
- and the first measurable improvement target.

FDEKit implication: recipes should include a small discovery checklist or operating model, not only `fde.config.ts`.

### Pick Workflows With A Scorecard

Do not put agents into every workflow. Pick the first workflow because it is frequent, painful, context-heavy, and measurable.

A practical scorecard:

| Signal | What To Look For | FDEKit Evidence |
| --- | --- | --- |
| Volume | The workflow happens hundreds or thousands of times, or touches enough money to matter. | Recipe README captures expected run frequency and business surface area. |
| Manual effort | People spend time gathering data, routing work, copying fields, or writing repetitive updates. | Discovery notes list manual steps and owner handoffs. |
| Fragmented systems | Context lives across Slack, email, CRM, ERP, tickets, repos, warehouses, or documents. | `connectors` list every system touched by the recipe. |
| Repeatable decisions | The work has patterns, business rules, and known exception types. | Agent instructions and eval datasets encode those patterns. |
| Measurable pain | Cycle time, error rate, rework, idle time, delayed revenue, or approval lag can be measured. | Console/report includes outcome metrics, not just model cost. |
| Risk boundary | High-risk judgment can stay with humans while lower-risk steps are automated. | Policies, scopes, approvals, and environment rules show the boundary. |

FDEKit implication: recipe workflow docs should capture the discovery narrative, while `defineWorkflow()` encodes the scorecard and current/target state directly in `fde.config.ts`.

### Split Work Into Three Buckets

The workflow redesign should separate work before agent implementation:

| Bucket | Use For | FDEKit Shape |
| --- | --- | --- |
| Deterministic automation | Parsing, routing, formatting, validation, retries, schema checks, joins, and repeatable transforms. | Connector helpers, scripts, typed route mappers, SQL validation, schema helpers. |
| Agent judgment | Summarization, classification, prioritization, context synthesis, natural language drafting, exception triage. | `defineAgent()`, provider selection, evals, macro evals, trace evidence. |
| Human judgment | High-risk approvals, policy exceptions, ambiguous customer-facing actions, financial/legal/security decisions. | `requireApproval()`, approval queue, audit logs, environment gates. |

FDEKit implication: recipes should avoid making the model do deterministic glue work. The model should make judgment calls over well-prepared context, while policies decide what it may do next.

### Keep Data Layers Separate

Most durable deployments distinguish four layers of data:

| Layer | Meaning | FDEKit Pattern |
| --- | --- | --- |
| System of record | The customer's durable source of truth: CRM, ERP, ticketing, repo, database, or warehouse. | Connector packages and customer API adapters. |
| Business rules | Human-owned policy, routing rules, thresholds, territories, approval logic, and playbooks. | Config, policy definitions, agent instructions, recipe docs. |
| Raw intake | Emails, Slack threads, tickets, forms, documents, transcripts, uploaded files, or API payloads. | Tool inputs, traces, redacted artifacts, eval datasets. |
| Feedback and memory | Human approvals, corrections, rejects, overrides, and observed outcomes. | Approval artifacts, audit logs, macro evals, future feedback datasets. |

Keeping these separate lets an operations owner change rules without changing connector code, and lets engineers improve the system without corrupting the source of truth.

FDEKit implication: avoid hiding business rules inside opaque prompts or connector handlers. Rules should be named, versioned, validated, and diffable whenever possible.

### Integrate Existing Systems

The fastest credible path is usually not a migration. It is a governed layer that reads and writes to the customer's existing systems.

FDEKit implication:

- keep connectors as first-class package boundaries,
- make custom connectors easy in the customer repo,
- prefer stable common tools such as `issue.create` or `crm.note.create` for the easy path,
- keep native tools available for advanced provider-specific behavior,
- and make connector evidence visible in the dashboard.

### Ship End-To-End Workflows

A single email drafter, ticket classifier, or note writer is too small to prove field deployment value. The stronger demo is a complete path from intake to outcome.

FDEKit implication: a recipe should touch at least two workflow stages. For example:

- support triage: ticket lookup -> customer lookup -> escalation -> issue creation -> Slack handoff,
- codebase agent: repo search -> file analysis -> issue creation -> eval evidence,
- sales research: account lookup -> contact discovery -> intent signals -> CRM note,
- load testing: environment target -> load run -> threshold evidence -> readiness report.

### Make Governance Visible

Enterprise trust comes from constraints, not from autonomy theater.

FDEKit implication:

- approvals should be visible in the console,
- tool scopes should be explicit,
- write actions should have environment rules,
- PII and secret handling should be enabled by default,
- and audit logs should show both agent action and human override.

### Build Self-Improvement Through Feedback

Agents improve when human feedback is captured as product data, not lost in Slack or a meeting note.

FDEKit should log:

- what the agent proposed,
- what context it used,
- which tool calls it made,
- whether a human approved, rejected, or corrected it,
- the reason for the override,
- and the eventual workflow outcome.

FDEKit implication: approvals and audit logs are also feedback datasets. Use `fdekit feedback export` to turn decided approvals and audit feedback into eval-candidate artifacts.

### Measure Outcomes, Not Just Tokens

Provider cost and latency matter, but they are not the main business story. FDEKit should also capture the operational metric a stakeholder cares about.

Examples:

- support: time to triage, escalation quality, reopen rate, SLA breach risk,
- engineering: issue quality, affected files identified, duplicate issue rate,
- sales: research time saved, CRM hygiene, next-step completeness,
- finance: exception reduction, close-cycle time, audit trace completeness,
- load testing: p95 latency, error rate, readiness threshold.

FDEKit implication: dashboard and report artifacts should keep cost/latency, but frame them under workflow outcomes and production readiness.

### Roll Out In Stages

Do not jump from local recipe to autonomous production writes.

Recommended stages:

1. Local demo with mock or local connectors.
2. Sandbox with customer-shaped systems and seeded data.
3. Customer data sample with writes disabled.
4. Shadow mode against real systems.
5. Human-approved writes for a narrow workflow.
6. Limited production allowlist.
7. Expanded production after eval and audit evidence is boring.

FDEKit implication: `environment`, tool `environments`, approvals, scopes, budgets, config snapshots, and migration notes are not extra features. They are the rollout spine.

## Recipe Requirements

Each launch-quality recipe should include:

| Area | Requirement |
| --- | --- |
| Workflow | A short description of the current process and target process. |
| Systems | At least one customer system connector, plus a clear custom connector path. |
| Agent | Instructions that describe when to gather context, when to act, and when to stop. |
| Governance | Explicit scopes, approvals for writes, environment separation, PII/secret handling, and budget cap. |
| Evals | Tool-call assertions, final-answer assertions, policy assertions, and at least one macro behavior check. |
| Metrics | One or more outcome metrics beyond provider cost and latency. |
| Data layers | Clear separation between systems of record, rules, intake data, and feedback/memory. |
| Evidence | Trace, audit, report, console, exports, and connector evidence. |
| Rollout | Local, shadow, approved-write, and production notes. |

## Dashboard Implications

The dashboard should be compact, stakeholder-safe by default, and deeper when an engineer needs details.

Primary view:

- workflow outcome summary,
- production readiness,
- tool and connector evidence,
- policy and approval status,
- eval confidence,
- cost and latency,
- report preview.

Engineer drill-down:

- raw trace timeline,
- full tool inputs/outputs after redaction,
- audit log,
- policy decisions,
- eval assertion details,
- connector request/response summaries,
- config diff and migration notes.

## API And Roadmap Implications

Current primitives already support most of this:

- `defineDeployment()` for the deployment boundary,
- `defineAgent()` for behavior,
- `defineConnector()` and `defineTool()` for customer systems,
- `defineGovernance()` for permissions, audit, and data protection,
- `defineHarness()` for controllable agent-loop phases that reference existing tools, policies, evals, artifacts, review, and steering,
- policies for approvals, cost, table restrictions, and tool limits,
- evals and macro evals for behavior proof,
- trace/report/console artifacts for review.

Field-method primitives make the workflow explicit in the deployment API:

```ts
defineWorkflow({
  name: 'enterprise-support-triage',
  owner: 'support-ops',
  scorecard: {
    volume: 'high',
    manualEffort: 'high',
    fragmentedSystems: ['tickets', 'customer-api', 'slack', 'issue-tracker'],
    measurablePain: ['triage-cycle-time', 'sla-breach-risk'],
  },
  currentState: {
    summary: 'Support manually gathers ticket, account, and escalation context.',
    handoffs: ['support', 'engineering', 'customer-success'],
    baseline: {
      cycleTime: '4h median triage',
    },
  },
  targetState: {
    summary: 'The agent gathers context and prepares a governed handoff.',
    target: '<30m triage for P1/P2',
    evidence: ['ticket summary', 'issue link', 'slack handoff'],
  },
});

defineOutcomeMetric({
  name: 'triage-cycle-time',
  target: '<30m for P1/P2',
  source: 'ticket.updatedAt - ticket.createdAt',
});

defineDataLayers({
  systemOfRecord: ['customer-api', 'ticketing'],
  businessRules: ['./rules/support-routing.yml'],
  rawIntake: ['ticket.body', 'slack.thread'],
  feedback: ['approvals', 'audit-overrides'],
});

defineRollout({
  stage: 'local',
  stages: ['local', 'sandbox', 'customer-sample', 'shadow', 'approved-write', 'production-allowlist'],
  next: 'Run against customer samples with writes disabled.',
});

const supportTriageToolLimit = limitToolUse({ maxCalls: 8 });
const supportTriageEval = defineEval({
  name: 'support-triage-dataset',
  agent: 'supportTriage',
  dataset: './evals/support-triage.json',
  maxSteps: 6,
  assertions: [
    expectedToolCall('ticket.get'),
    expectedToolCall('customer.get'),
    expectedToolCall('issue.create'),
    noPolicyViolation(),
  ],
});

defineHarness({
  name: 'support-triage-governed-loop',
  maxSteps: 8,
  phases: [
    {
      name: 'context',
      toolRefs: ['ticket.get', 'customer.get'],
      artifactRefs: ['trace'],
      maxSteps: 2,
    },
    {
      name: 'decision',
      policyRefs: ['deny-pii-leak', 'redact-secrets', 'limit-cost'],
      evalRefs: [supportTriageEval],
      maxSteps: 2,
    },
    {
      name: 'action',
      toolRefs: ['issue.create', 'slack.message'],
      policyRefs: ['limit-tool-scopes', 'restrict-environments', supportTriageToolLimit],
      artifactRefs: ['approval', 'audit'],
      maxSteps: 3,
    },
    {
      name: 'review',
      evalRefs: [supportTriageEval],
      artifactRefs: ['eval', 'report', 'dashboard'],
      maxSteps: 1,
    },
  ],
  toolRefs: ['ticket.get', 'customer.get', 'issue.create', 'slack.message'],
  policyRefs: ['deny-pii-leak', 'redact-secrets', 'limit-tool-scopes', 'limit-cost', supportTriageToolLimit],
  evalRefs: [supportTriageEval],
  artifactRefs: ['trace', 'approval', 'audit', 'eval', 'report', 'dashboard'],
  review: { evalRefs: [supportTriageEval], artifactRefs: ['report', 'dashboard'] },
  steer: { enabled: true, maxAttempts: 1, triggerRefs: [supportTriageEval, 'deny-pii-leak', 'limit-cost'] },
});
```

The console and export bundle read these top-level primitives first. `defineWorkflow()` explains the business process. `defineHarness()` explains how the agent is allowed to move through that process by pointing at the existing tools, policies, evals, and artifacts. Deployment `metadata` remains available for extra project-specific notes such as demo impact estimates, and older metadata-shaped recipes remain readable as a fallback.

When a customer-specific deployment works, capture it as a reusable recipe:

```bash
fdekit recipe capture renewal-risk-triage
```

That stores the active config, agent instructions, evals, workflow docs, env example, package metadata, and deployment snapshot under `recipes/renewal-risk-triage/`. Another project can install it with `fdekit recipe install /path/to/recipes/renewal-risk-triage`.

## Launch Positioning

FDEKit should not present itself as a generic model wrapper.

The sharper claim:

> FDEKit turns repeated customer AI deployments into governed, evaluated, observable recipes that connect to real systems and produce customer-reviewable evidence.

That aligns the product with how field-deployed work is actually sold, built, reviewed, and expanded.

## Next Step

If you just mapped a workflow, read the [Production Hardening Guide](./production-hardening.md) to turn the method into strict validation, approvals, redaction, budgets, rollout gates, and runbooks. Then use [Versioning And Migration Notes](./cookbook/versioning-and-migrations.md) to capture snapshots and migration notes before handoff.
