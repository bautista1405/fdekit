import { promises as fs } from 'fs';
import * as path from 'path';
import { fdekitCaretDependencyVersion } from '../package-versions.js';
import { writeFileIfMissing } from '../utils/files.js';
import { renderStarterConfig } from './templates/starter-config.js';

export async function scaffoldProject(projectDir: string, name: string): Promise<void> {
  await fs.mkdir(projectDir, { recursive: true });
  await fs.mkdir(path.join(projectDir, 'agents'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'evals'), { recursive: true });

  await writeFileIfMissing(path.join(projectDir, 'workflow.md'), starterWorkflowDoc(name));
  await writeFileIfMissing(path.join(projectDir, 'agents', 'support-triage.md'), starterAgentPrompt());
  await writeFileIfMissing(path.join(projectDir, 'evals', 'support-triage.json'), starterEvalDataset());
  await writeFileIfMissing(path.join(projectDir, 'fde.config.ts'), renderStarterConfig(name));
  await writeFileIfMissing(path.join(projectDir, 'package.json'), starterPackageJson(name));
  await writeFileIfMissing(path.join(projectDir, '.env.example'), starterEnvExample());
  await writeFileIfMissing(path.join(projectDir, '.gitignore'), starterGitignore());
}

function starterAgentPrompt(): string {
  return `You are a support triage agent.

Classify customer issues, look up relevant customer context, decide whether escalation is needed, and create concise handoff notes.
`;
}

function starterEvalDataset(): string {
  return `${JSON.stringify([
    {
      name: 'enterprise-customer-escalation',
      input: {
        message: 'company Corp cannot access billing and says this blocks renewal',
      },
    },
  ], null, 2)}\n`;
}

function starterPackageJson(name: string): string {
  return `${JSON.stringify({
    name,
    version: '0.1.0',
    private: true,
    scripts: {
      agent: 'fdekit run supportTriage --input \'{"message":"An enterprise customer cannot access billing and says renewal is blocked."}\'',
      dev: 'fdekit dev',
      doctor: 'fdekit doctor',
      approvals: 'fdekit approvals list',
      audit: 'fdekit audit',
      feedback: 'fdekit feedback export',
      validate: 'fdekit validate',
      'validate:strict': 'fdekit validate --strict',
      diff: 'fdekit diff',
      eval: 'fdekit eval run',
      macro: 'fdekit eval macro',
      report: 'fdekit report',
    },
    dependencies: {
      '@fdekit/core': fdekitCaretDependencyVersion,
    },
    devDependencies: {
      '@fdekit/cli': fdekitCaretDependencyVersion,
    },
  }, null, 2)}\n`;
}

function starterEnvExample(): string {
  return `# Copy this file to .env.
# Keep mock for a credential-free smoke test, or choose one live provider:
# localOllama, openai, anthropic, or google.
FDEKIT_PROVIDER=mock

# Optional. Leave blank to use the selected provider's default model.
FDEKIT_MODEL=

# Fill only the credential used by your selected provider.
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# Used only when FDEKIT_PROVIDER=localOllama.
OLLAMA_BASE_URL=http://127.0.0.1:11434
`;
}

function starterGitignore(): string {
  return `/artifacts/
node_modules
.env
`;
}

function starterWorkflowDoc(name: string): string {
  return `# ${name} Workflow

Use this file before changing agent logic; the goal is to decide whether this workflow is worth automating and where deterministic code, agent judgment, and human approval each belong.

## Current Workflow

- Manual steps: replace with the steps humans take today.
- Handoffs: support -> engineering -> customer-success.
- Systems of record: ticketing system, customer API/CRM, issue tracker.
- Recurring exceptions: renewal risk, billing access, production availability, unclear owner.
- Baseline metric: replace with cycle time, error rate, manual hours, approval delay, or revenue risk.

## Target Workflow

- Deterministic automation: route builders, schema validation, retries, connector calls, redaction.
- Agent judgment: summarize ticket, classify priority, decide whether escalation is appropriate.
- Human judgment: approve external writes and high-risk customer-facing actions.
- First improvement target: replace with a measurable target.

## Scorecard

| Signal | Rating | Notes |
| --- | --- | --- |
| Volume | unknown | How often does this workflow run? |
| Manual effort | unknown | Where do people copy, search, retype, or wait? |
| Fragmented systems | medium | Tickets, customer context, issue tracker, Slack. |
| Repeatable decisions | medium | Escalation rules should be encoded in prompt, policy, and evals. |
| Measurable pain | unknown | Add baseline and target metrics before a customer pilot. |
| Risk boundary | high | Keep writes approval-gated until rollout proves safe. |

## Data Layers

- System of record: customer API or ticketing system.
- Business rules: agent instructions and governance policies.
- Raw intake: ticket body and customer/account fields.
- Feedback and memory: approvals, rejects, corrections, audit logs, and future eval cases.

## Rollout

1; local demo with the mock provider.
2; sandbox with customer-shaped data.
3; customer sample with writes disabled.
4; shadow mode against real systems.
5; human-approved writes.
6; production allowlist.
`;
}
