import {
  defineAgent,
  defineDataLayers,
  defineDeployment,
  defineEval,
  defineGovernance,
  defineHarness,
  defineOutcomeMetric,
  defineRollout,
  defineWorkflow,
  expectedFinalAnswer,
  expectedToolCall,
  limitToolUse,
  maxCost,
  maxLatency,
  noPolicyViolation,
  pick,
  type ConnectorDefinition,
  type ProviderConfig,
} from '@fdekit/core';
import { codebaseConnector } from '@fdekit/connector-codebase';
import { githubConnector } from '@fdekit/connector-github';
import { jiraConnector } from '@fdekit/connector-jira';
import { linearConnector } from '@fdekit/connector-linear';
import { anthropicProvider } from '@fdekit/provider-anthropic';
import { googleProvider } from '@fdekit/provider-google';
import { localOllamaProvider } from '@fdekit/provider-ollama';
import { openaiProvider } from '@fdekit/provider-openai';

import { createCodebaseAgentMockPlanner } from './mock-planner.mjs';

const codebaseAgentMockPlanner = createCodebaseAgentMockPlanner();

type ProviderChoice = 'mock' | 'localOllama' | 'openai' | 'anthropic' | 'google';
type IssueTrackerChoice = 'github' | 'jira' | 'linear';
type ConnectorMode = 'local' | 'api';

const defaultModels = {
  mock: 'codebase-agent-local',
  localOllama: 'llama3.1:8b',
  openai: 'gpt-5.5',
  anthropic: 'claude-opus-4-8',
  google: 'gemini-3.5-flash',
} satisfies Record<ProviderChoice, string>;

const provider = pick(process.env.FDEKIT_PROVIDER, ['mock', 'localOllama', 'openai', 'anthropic', 'google'], 'mock');
const settings = {
  provider,
  model: process.env.FDEKIT_MODEL || defaultModels[provider],
  issueTracker: pick(process.env.FDEKIT_ISSUE_TRACKER, ['github', 'jira', 'linear'], 'github'),
  connectorMode: pick(process.env.FDEKIT_CONNECTOR_MODE, ['local', 'api'], 'local'),
  codebaseRoot: process.env.CODEBASE_ROOT ?? './sample-repo',
} satisfies {
  provider: ProviderChoice;
  model: string;
  issueTracker: IssueTrackerChoice;
  connectorMode: ConnectorMode;
  codebaseRoot: string;
};

const codebase = codebaseConnector({
  rootDir: settings.codebaseRoot,
});

const providerFactories = {
  mock: () => ({
    name: 'mock',
    model: settings.model,
    options: {
      planner: codebaseAgentMockPlanner,
    },
  }),
  localOllama: () => localOllamaProvider({
    model: settings.model,
    apiBaseUrl: process.env.OLLAMA_BASE_URL,
  }),
  openai: () => openaiProvider({
    model: settings.model,
  }),
  anthropic: () => anthropicProvider({
    model: settings.model,
  }),
  google: () => googleProvider({
    model: settings.model,
  }),
} satisfies Record<ProviderChoice, () => ProviderConfig>;

const providers = {
  [settings.provider]: providerFactories[settings.provider](),
};

const issueTrackers = {
  github: () => githubConnector({
    mode: settings.connectorMode,
    repository: process.env.GITHUB_REPOSITORY ?? 'company/codebase-agent',
    tokenEnv: 'GITHUB_TOKEN',
    repositoryEnv: 'GITHUB_REPOSITORY',
  }),
  jira: () => jiraConnector({
    mode: settings.connectorMode,
    baseUrl: process.env.JIRA_BASE_URL,
    projectKey: process.env.JIRA_PROJECT_KEY,
  }),
  linear: () => linearConnector({
    mode: settings.connectorMode,
    teamId: process.env.LINEAR_TEAM_ID,
  }),
} satisfies Record<IssueTrackerChoice, () => ConnectorDefinition>;

const issues = issueTrackers[settings.issueTracker]();

const codebaseToolLimit = limitToolUse({ maxCalls: 6 });
const codebaseReviewEval = defineEval({
  name: 'codebase-agent-dataset',
  agent: 'codebaseAgent',
  dataset: './evals/codebase-agent.json',
  maxSteps: 6,
  assertions: [
    expectedToolCall('codebase.search'),
    expectedToolCall('codebase.readFile'),
    expectedToolCall('issue.create'),
    expectedFinalAnswer(/TODO\(fdekit\)|billing|src\/billing\.ts/i),
    noPolicyViolation(),
    maxLatency(10000),
    maxCost(0.25),
  ],
});

export default defineDeployment({
  name: 'codebase-agent-example',
  version: '0.1.0',
  recipe: {
    name: 'codebase-agent',
    version: '0.1.0',
  },
  migrationNotes: [
    {
      from: '0.0.x',
      to: '0.1.0',
      summary: 'Initial codebase-agent recipe version',
      steps: [
        'Set CODEBASE_ROOT to the customer repository before running live evals',
        'Run fdekit validate after changing issue tracker backends or codebase tool scopes',
      ],
    },
  ],
  // Runtime uses providers, connectors, agents, governance, evals, harness, and artifacts.
  // Workflow/outcomeMetrics/dataLayers/rollout are field-method narrative for reports and recipe handoff.
  environment: 'local',
  workflow: defineWorkflow({
    name: 'Codebase production-readiness review',
    owner: 'engineering',
    currentState: {
      summary: 'Engineers manually search customer repositories, inspect files, and create follow-up issues for production-readiness gaps',
      handoffs: ['forward-deployed-engineer', 'customer-engineering', 'platform-owner'],
      baseline: {
        cycleTime: '1h manual review for targeted findings',
        manualSteps: 6,
      },
    },
    targetState: {
      summary: 'The agent searches the configured repository, reads evidence, creates a tracker issue, and records eval/audit evidence',
      target: '<15m from requested signal to issue-ready handoff',
      evidence: ['search result', 'file path', 'issue link', 'eval result', 'audit record'],
    },
    scorecard: {
      volume: 'medium',
      manualEffort: 'high',
      fragmentedSystems: ['customer repo', 'issue tracker', 'eval artifacts'],
      repeatableDecisions: 'medium',
      measurablePain: ['review-cycle-time', 'issue-quality', 'missed-production-readiness-gaps'],
      riskBoundary: 'Repository reads are allowed in local/staging; issue creation is approval-gated before production',
    },
  }),
  outcomeMetrics: [
    defineOutcomeMetric({
      name: 'issue-quality',
      baseline: 'manual review notes vary by FDE',
      target: 'all created issues include path, evidence, and next action',
    }),
    defineOutcomeMetric({
      name: 'review-cycle-time',
      baseline: '1h targeted manual review',
      target: '<15m issue-ready handoff',
    }),
  ],
  dataLayers: defineDataLayers({
    systemOfRecord: ['customer repository', 'issue tracker'],
    businessRules: ['./agents/codebase-agent.md', 'governance policies', 'eval assertions'],
    rawIntake: ['task input', 'codebase.search results', 'codebase.readFile contents'],
    feedback: ['artifacts/approvals', 'artifacts/audit', 'artifacts/evals'],
  }),
  rollout: defineRollout({
    stage: 'local',
    stages: ['local', 'sandbox', 'customer-sample', 'shadow', 'approved-write', 'production-allowlist'],
    next: 'Set CODEBASE_ROOT to a customer repository and keep issue writes local or approval-gated',
  }),
  harness: defineHarness({
    name: 'codebase-review-harness',
    description: 'Search, inspect, file issue, and review phases for customer codebase deployments',
    maxSteps: 7,
    phases: [
      {
        name: 'context',
        description: 'Search and read only the files needed for the requested finding',
        toolRefs: ['codebase.search', 'codebase.readFile'],
        artifactRefs: ['trace', 'file-evidence'],
        maxSteps: 3,
      },
      {
        name: 'finding',
        description: 'Summarize the production-readiness gap with path, impact, and next action',
        policyRefs: ['deny-pii-leak', 'redact-secrets', 'limit-cost'],
        evalRefs: [codebaseReviewEval],
        artifactRefs: ['finding-summary'],
        maxSteps: 2,
      },
      {
        name: 'action',
        description: 'Create a tracker issue through the stable issue.create tool',
        toolRefs: ['issue.create'],
        policyRefs: ['limit-tool-scopes', 'restrict-environments', codebaseToolLimit],
        artifactRefs: ['issue-link', 'audit'],
        maxSteps: 1,
      },
      {
        name: 'review',
        description: 'Run evals and preserve dashboard/report evidence for the customer handoff',
        evalRefs: [codebaseReviewEval],
        artifactRefs: ['eval', 'report', 'dashboard'],
        maxSteps: 1,
      },
    ],
    toolRefs: ['codebase.search', 'codebase.readFile', 'issue.create'],
    policyRefs: ['deny-pii-leak', 'redact-secrets', 'limit-tool-scopes', 'restrict-environments', 'limit-cost', codebaseToolLimit],
    evalRefs: [codebaseReviewEval],
    artifactRefs: ['trace', 'file-evidence', 'issue-link', 'audit', 'eval', 'report', 'dashboard'],
    review: {
      evalRefs: [codebaseReviewEval],
      artifactRefs: ['report', 'dashboard'],
    },
    steer: {
      enabled: true,
      maxAttempts: 1,
      triggerRefs: [codebaseReviewEval, 'deny-pii-leak', 'limit-cost'],
    },
  }),
  metadata: {
    businessImpact: {
      workflow: 'Codebase production-readiness review',
      estimatedMinutesSaved: 45,
    },
  },
  providers,
  connectors: {
    codebase,
    issues,
  },
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
      allowedScopes: ['codebase:read', 'issues:write'],
      requireScopes: true,
    },
    environments: {
      allowed: ['local', 'development', 'staging'],
      tools: ['issue.create', 'jira.issue.create', 'linear.issue.create'],
    },
    budgets: [
      {
        scope: 'deployment',
        maxUsd: 0.25,
      },
    ],
  }),
  agents: {
    codebaseAgent: defineAgent({
      provider: settings.provider,
      instructions: './agents/codebase-agent.md',
      policies: [
        codebaseToolLimit,
      ],
    }),
  },
  evals: [
    codebaseReviewEval,
  ],
});
