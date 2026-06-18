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
  expectedToolCall,
  limitToolUse,
  maxCost,
  maxLatency,
  noPolicyViolation,
} from '@fdekit/core';
import { customerApiConnector } from '@fdekit/connector-customer-api';
import { githubConnector } from '@fdekit/connector-github';
import { slackConnector } from '@fdekit/connector-slack';

import { createSupportTriageMockPlanner } from './mock-planner.mjs';

const supportTriageMockPlanner = createSupportTriageMockPlanner();

const externalConnectorMode = process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local';
// Resolves CUSTOMER_API_URL at call time; defaults to http://127.0.0.1:8787
const customerApi = customerApiConnector();
const github = githubConnector({
  mode: externalConnectorMode,
  repository: process.env.GITHUB_REPOSITORY ?? 'company/support-triage',
  tokenEnv: 'GITHUB_TOKEN',
  repositoryEnv: 'GITHUB_REPOSITORY',
});
const slack = slackConnector({
  mode: externalConnectorMode,
  defaultChannel: process.env.SLACK_CHANNEL_ID ?? '#support-escalations',
  tokenEnv: 'SLACK_BOT_TOKEN',
  channelEnv: 'SLACK_CHANNEL_ID',
});

const supportTriageToolLimit = limitToolUse({ maxCalls: 8 });
const supportTriageEval = defineEval({
  name: 'support-triage-dataset',
  agent: 'supportTriage',
  dataset: './evals/support-triage.json',
  maxSteps: 8,
  assertions: [
    expectedToolCall('ticket.get'),
    expectedToolCall('customer.get'),
    noPolicyViolation(),
    maxLatency(10000),
    maxCost(0.25),
  ],
});

export default defineDeployment({
  name: 'support-triage-example',
  version: '0.1.0',
  recipe: {
    name: 'support-triage',
    version: '0.1.0',
  },
  migrationNotes: [
    {
      from: '0.0.x',
      to: '0.1.0',
      summary: 'Initial support-triage recipe version',
      steps: [
        'Review .env.example before enabling live Slack or GitHub connector mode',
        'Run fdekit validate after customizing customer API routes, policies, or eval datasets',
      ],
    },
  ],
  // Runtime uses providers, connectors, agents, governance, evals, harness, and artifacts.
  // Workflow/outcomeMetrics/dataLayers/rollout are field-method narrative for reports and recipe handoff.
  environment: 'local',
  workflow: defineWorkflow({
    name: 'Support triage escalation',
    owner: 'support-ops',
    currentState: {
      summary: 'Support manually gathers customer, subscription, and ticket context before escalating renewal-risk issues',
      handoffs: ['support', 'engineering', 'customer-success'],
      baseline: {
        cycleTime: '4h median triage for high-priority enterprise tickets',
        manualSteps: 7,
      },
    },
    targetState: {
      summary: 'The agent gathers context, creates the engineering issue, notifies Slack, and moves the ticket into escalation with approval evidence',
      target: '<30m triage for P1/P2 enterprise renewal-risk tickets',
      evidence: ['ticket summary', 'customer context', 'issue link', 'Slack handoff', 'approval/audit record'],
    },
    scorecard: {
      volume: 'high',
      manualEffort: 'high',
      fragmentedSystems: ['customer-api', 'ticketing', 'github', 'slack'],
      repeatableDecisions: 'high',
      measurablePain: ['triage-cycle-time', 'sla-breach-risk', 'handoff-quality'],
      riskBoundary: 'Issue creation, Slack notifications, and ticket escalation remain approval-gated before production',
    },
  }),
  outcomeMetrics: [
    defineOutcomeMetric({
      name: 'triage-cycle-time',
      baseline: '4h median',
      target: '<30m for P1/P2',
    }),
    defineOutcomeMetric({
      name: 'sla-breach-risk',
      baseline: 'manual escalation review',
      target: 'all renewal-risk tickets routed with evidence',
    }),
  ],
  dataLayers: defineDataLayers({
    systemOfRecord: ['customer-api tickets', 'customer subscription records', 'issue tracker'],
    businessRules: ['./agents/support-triage.md', 'governance policies', 'eval assertions'],
    rawIntake: ['ticket.body', 'ticket.priority', 'customer.tier', 'subscription.status'],
    feedback: ['artifacts/approvals', 'artifacts/audit', 'artifacts/evals'],
  }),
  rollout: defineRollout({
    stage: 'local',
    stages: ['local', 'sandbox', 'customer-sample', 'shadow', 'approved-write', 'production-allowlist'],
    next: 'Point CUSTOMER_API_URL at a customer-owned support API sample and keep external writes approval-gated',
  }),
  harness: defineHarness({
    name: 'support-triage-governed-loop',
    description: 'Context, decision, governed action, and review phases for support escalation',
    maxSteps: 8,
    phases: [
      {
        name: 'context',
        description: 'Gather ticket, customer, and subscription evidence',
        toolRefs: ['ticket.get', 'customer.get'],
        artifactRefs: ['trace'],
        maxSteps: 2,
      },
      {
        name: 'decision',
        description: 'Classify escalation risk against business rules and policy',
        policyRefs: ['deny-pii-leak', 'redact-secrets', 'limit-cost'],
        evalRefs: [supportTriageEval],
        maxSteps: 2,
      },
      {
        name: 'action',
        description: 'Create the issue, send Slack, and escalate through existing policy and scope checks',
        toolRefs: ['issue.create', 'slack.message', 'ticket.escalate'],
        policyRefs: ['limit-tool-scopes', 'restrict-environments', supportTriageToolLimit],
        artifactRefs: ['audit'],
        maxSteps: 3,
      },
      {
        name: 'review',
        description: 'Run evals and produce report/dashboard evidence for handoff',
        evalRefs: [supportTriageEval],
        artifactRefs: ['eval', 'report', 'dashboard'],
        maxSteps: 1,
      },
    ],
    toolRefs: ['ticket.get', 'customer.get', 'issue.create', 'slack.message', 'ticket.escalate'],
    policyRefs: ['deny-pii-leak', 'redact-secrets', 'limit-tool-scopes', 'restrict-environments', 'limit-cost', supportTriageToolLimit],
    evalRefs: [supportTriageEval],
    artifactRefs: ['trace', 'audit', 'eval', 'report', 'dashboard'],
    review: {
      evalRefs: [supportTriageEval],
      artifactRefs: ['report', 'dashboard'],
    },
    steer: {
      enabled: true,
      maxAttempts: 1,
      triggerRefs: [supportTriageEval, 'deny-pii-leak', 'limit-cost'],
    },
  }),
  metadata: {
    businessImpact: {
      workflow: 'Support triage escalation',
      estimatedMinutesSaved: 30,
    },
  },
  providers: {
    mock: {
      name: 'mock',
      model: 'support-triage-local',
      options: {
        planner: supportTriageMockPlanner,
      },
    },
  },
  connectors: {
    customerApi,
    github,
    slack,
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
      allowedScopes: ['customer:read', 'ticket:read', 'ticket:write', 'issues:write', 'slack:write'],
      requireScopes: true,
    },
    environments: {
      allowed: ['local', 'development', 'staging'],
      tools: ['issue.create', 'slack.message', 'ticket.escalate'],
    },
    budgets: [
      {
        scope: 'deployment',
        maxUsd: 0.25,
      },
    ],
  }),
  agents: {
    supportTriage: defineAgent({
      provider: 'mock',
      instructions: './agents/support-triage.md',
      policies: [
        supportTriageToolLimit,
      ],
    }),
  },
  evals: [
    supportTriageEval,
  ],
});
