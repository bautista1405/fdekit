import { escapeSingleQuoted } from '../../utils/strings.js';

export function renderStarterConfig(name: string): string {
  return `import {
  defineAgent,
  defineDataLayers,
  defineDeployment,
  defineEval,
  defineGovernance,
  defineHarness,
  defineOutcomeMetric,
  defineRollout,
  defineWorkflow,
  limitToolUse,
  maxLatency,
  noPolicyViolation,
  pick,
  type ProviderConfig,
} from '@fdekit/core';

type ProviderChoice = 'mock' | 'localOllama' | 'openai' | 'anthropic' | 'google';

const defaultModels = {
  mock: 'starter-local',
  localOllama: 'llama3.1:8b',
  openai: 'gpt-5.5',
  anthropic: 'claude-opus-4-8',
  google: 'gemini-3.5-flash',
} satisfies Record<ProviderChoice, string>;

const provider = pick(process.env.FDEKIT_PROVIDER, ['mock', 'localOllama', 'openai', 'anthropic', 'google'], 'mock');

const settings = {
  provider,
  model: process.env.FDEKIT_MODEL || defaultModels[provider],
} satisfies {
  provider: ProviderChoice;
  model: string;
};

const providerFactories = {
  mock: () => ({
    name: 'mock',
    model: settings.model,
  }),
  localOllama: () => ({
    name: 'localOllama',
    model: settings.model,
    env: [
      {
        name: 'OLLAMA_BASE_URL',
        required: false,
        description: 'Optional Ollama server URL; defaults to http://127.0.0.1:11434',
      },
      {
        name: 'FDEKIT_MODEL',
        required: false,
        description: 'Optional model override for the selected provider',
      },
    ],
    options: {
      apiBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
      format: 'json',
      keepAlive: '5m',
      numPredict: 800,
      temperature: 0,
    },
  }),
  openai: () => ({
    name: 'openai',
    model: settings.model,
    apiKeyEnv: 'OPENAI_API_KEY',
    env: [
      {
        name: 'OPENAI_API_KEY',
        required: true,
        description: 'OpenAI API key used by the runtime provider adapter',
      },
    ],
    options: {
      maxOutputTokens: 800,
    },
  }),
  anthropic: () => ({
    name: 'anthropic',
    model: settings.model,
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    env: [
      {
        name: 'ANTHROPIC_API_KEY',
        required: true,
        description: 'Anthropic API key used by the runtime provider adapter',
      },
    ],
    options: {
      anthropicVersion: '2023-06-01',
      maxTokens: 800,
    },
  }),
  google: () => ({
    name: 'google',
    model: settings.model,
    apiKeyEnv: 'GEMINI_API_KEY',
    env: [
      {
        name: 'GEMINI_API_KEY',
        required: true,
        description: 'Google Gemini API key used by the runtime provider adapter',
      },
    ],
    options: {
      apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      maxOutputTokens: 800,
      responseMimeType: 'application/json',
      temperature: 1,
    },
  }),
} satisfies Record<ProviderChoice, () => ProviderConfig>;

const providers = {
  [settings.provider]: providerFactories[settings.provider](),
};

const supportTriageToolLimit = limitToolUse({ maxCalls: 8 });
const supportTriageAgentSmoke = defineEval({
  name: 'support-triage-agent-smoke',
  assertions: [
    noPolicyViolation(),
    maxLatency(10000),
  ],
});
const deploymentSmoke = defineEval({
  name: 'deployment-smoke',
  assertions: [
    noPolicyViolation(),
    maxLatency(10000),
  ],
});

export default defineDeployment({
  name: '${escapeSingleQuoted(name)}',
  version: '0.1.0',
  environment: 'local',
  workflow: defineWorkflow({
    name: 'Starter support triage',
    owner: 'support-ops',
    currentState: {
      summary: 'Support teams manually inspect customer context, classify tickets, and decide when to escalate',
      handoffs: ['support', 'engineering', 'customer-success'],
      baseline: {
        cycleTime: 'replace with customer baseline',
        manualSteps: 5,
      },
    },
    targetState: {
      summary: 'The agent gathers context, recommends the escalation path, and prepares a governed handoff',
      target: 'replace with first measurable improvement target',
      evidence: ['ticket summary', 'customer context', 'approval/audit record'],
    },
    scorecard: {
      volume: 'unknown',
      manualEffort: 'unknown',
      fragmentedSystems: ['support tickets', 'customer records', 'issue tracker', 'Slack'],
      repeatableDecisions: 'medium',
      measurablePain: ['triage-cycle-time', 'handoff-quality'],
      riskBoundary: 'External writes should stay approval-gated until the customer accepts the workflow',
    },
  }),
  outcomeMetrics: [
    defineOutcomeMetric({
      name: 'triage-cycle-time',
      baseline: 'replace with customer baseline',
      target: 'replace with customer target',
    }),
  ],
  dataLayers: defineDataLayers({
    systemOfRecord: ['customer API or ticketing system'],
    businessRules: ['./agents/support-triage.md', 'governance policies'],
    rawIntake: ['ticket body', 'customer account context'],
    feedback: ['.fdekit/approvals', '.fdekit/audit'],
  }),
  rollout: defineRollout({
    stage: 'local',
    stages: ['local', 'sandbox', 'customer-sample', 'shadow', 'approved-write', 'production-allowlist'],
    next: 'Replace placeholder workflow baselines and point connectors at customer-shaped data',
  }),
  harness: defineHarness({
    name: 'starter-governed-loop',
    description: 'A minimal field-deployment harness that references existing tools, policies, evals, and artifacts',
    maxSteps: 8,
    phases: [
      {
        name: 'context',
        description: 'Read customer and ticket context before deciding',
        artifactRefs: ['trace'],
        maxSteps: 2,
      },
      {
        name: 'decision',
        description: 'Apply business rules and governance before any write',
        policyRefs: ['deny-pii-leak', 'redact-secrets', 'limit-cost'],
        evalRefs: [deploymentSmoke],
        maxSteps: 2,
      },
      {
        name: 'action',
        description: 'Prepare or execute the handoff through tools governed by policy',
        policyRefs: ['limit-tool-scopes', 'restrict-environments', supportTriageToolLimit],
        artifactRefs: ['audit'],
        maxSteps: 3,
      },
      {
        name: 'review',
        description: 'Run evals and generate handoff evidence',
        evalRefs: [deploymentSmoke, supportTriageAgentSmoke],
        artifactRefs: ['eval', 'report', 'dashboard'],
        maxSteps: 1,
      },
    ],
    policyRefs: ['deny-pii-leak', 'redact-secrets', 'limit-tool-scopes', 'restrict-environments', 'limit-cost', supportTriageToolLimit],
    evalRefs: [deploymentSmoke, supportTriageAgentSmoke],
    artifactRefs: ['trace', 'audit', 'eval', 'report', 'dashboard'],
    review: {
      evalRefs: [deploymentSmoke, supportTriageAgentSmoke],
      artifactRefs: ['report', 'dashboard'],
    },
    steer: {
      enabled: true,
      maxAttempts: 1,
      triggerRefs: [deploymentSmoke, supportTriageAgentSmoke, 'deny-pii-leak', 'limit-cost'],
    },
  }),
  providers,
  governance: defineGovernance({
    audit: {
      enabled: true,
      retentionDays: 30,
      redactSensitive: true,
    },
    dataProtection: {
      denyPII: true,
      redactSecrets: true,
    },
    permissions: {
      allowedScopes: ['customer:read', 'ticket:read', 'issues:write', 'slack:write', 'database:read'],
      requireScopes: true,
    },
    environments: {
      allowed: ['local', 'development', 'staging'],
      tools: ['issue.create', 'slack.message', 'postgres.query'],
    },
    budgets: [
      {
        scope: 'deployment',
        maxUsd: 0.25,
      },
    ],
  }),
  connectors: {},
  agents: {
    supportTriage: defineAgent({
      provider: settings.provider,
      instructions: './agents/support-triage.md',
      tools: [],
      policies: [
        supportTriageToolLimit,
      ],
      evals: [
        supportTriageAgentSmoke,
      ],
    }),
  },
  evals: [
    deploymentSmoke,
  ],
});
`;
}
