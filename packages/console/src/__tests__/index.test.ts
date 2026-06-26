import { describe, expect, it } from 'vitest';
import type { DeploymentDefinition } from '@fdekit/core';
import type { ApprovalArtifact, AuditLogEntry, EvalArtifact, TraceArtifact } from '@fdekit/runtime';
import { createConsoleExportBundle, renderConsole, renderConsolePages } from '../index.js';
import { dashboardSectionStrategies } from '../sections/index.js';

describe('renderConsole', () => {
  it('renders deployment, eval, trace, tool, and governance data', () => {
    const pages = renderConsolePages({
      deployment,
      traces: [trace],
      latestEval: evalArtifact,
      reportMarkdown: '# Report\n\n- Status: passed',
      approvals: [approval],
      auditLog,
      createdAt: '2026-05-22T12:00:00.000Z',
      history: [{
        createdAt: '2026-05-22T12:00:00.000Z',
        deployment: 'support-triage-example',
        evalStatus: 'passed',
        traceCount: 1,
        file: 'consoles/console-2026-05-22.html',
      }],
    });
    const html = pages.map((page) => page.html).join('\n');

    expect(pages.map((page) => page.fileName)).toEqual([
      'console.html',
      'brief.html',
      'readiness.html',
      'charts.html',
      'workbench.html',
    ]);
    expectTextIncludes(html, [
      'FDEKit Console',
      'support-triage-example',
      'href="charts.html"',
      'href="brief.html"',
      'href="readiness.html"',
      'href="workbench.html"',
      'Review snapshot',
      'Key results',
      'Latest eval scope',
      'Eval',
      'ticket.get',
      'customer.get',
      'enterprise billing escalation',
      'Policy evaluations',
      'Signals',
      'Execution Summary',
      'Controls',
      'Customer Brief',
      'Business Impact',
      'Field Method',
      'Support triage escalation',
      'Workflow Map',
      'Integration Readiness',
      'Production Readiness',
      'Engineer Review',
      'Review Gates',
      'Permission Scopes',
    ]);
    expect(html).not.toContain('Demo Readiness');
    expectTextIncludes(html, [
      'Connector Evidence',
      'Approval Queue',
      'appr_issue_create',
      'Governance Review',
      'Policy-as-Code',
      'limit-tool-scopes',
      'Allowed scopes',
      'Export dashboard data',
      'downloadExport',
      'Latest Run Story',
      'Customer Evidence',
      'Customer Report',
      'Created Issues',
      'ENG-1',
      'jira.local',
      'Slack Notifications',
      '#support-escalations',
    ]);
    expect(html).not.toContain('Trace Timeline');
    expect(html).not.toContain('Macro Evals');
    expect(html).not.toContain('Dashboard History');
  });

  it('renders CSV, Markdown, and JSON export payloads', () => {
    const bundle = createConsoleExportBundle({
      deployment,
      traces: [trace],
      latestEval: evalArtifact,
      reportMarkdown: '# Report\n\n- Status: passed',
      approvals: [approval],
      auditLog,
      createdAt: '2026-05-22T12:00:00.000Z',
    });

    expectTextIncludes(bundle.dashboardCsv, [
      'record_type,id,created_at,status,title',
      'issue,ENG-1',
      'slack,2026-05-22T12:00:01.000Z',
      'workflow_scorecard',
      'data_layer',
      'outcome_metric',
      'harness_phase',
      'harness_reference',
    ]);
    expectTextIncludes(bundle.summaryMarkdown, [
      '# support-triage-example Dashboard Export',
      'Deployment health score:',
      '## Field Deployment Method',
      'Support triage escalation',
      '### Deployment Harness',
      'support-triage-governed-loop',
      '## Business Impact',
      '## Workflow Map',
      '## Integration Readiness',
      '## Production Readiness',
      '## Connector Evidence',
      '## Approval Queue',
      '## Pattern Reuse',
      '## Policy-as-Code',
      '## Budget Caps',
      '## Created Issues',
    ]);
    const parsed = JSON.parse(bundle.dataJson) as {
      deployment?: { name?: string };
      readinessSignals?: unknown[];
      fieldMethod?: {
        workflowName?: string;
        scorecard?: unknown[];
        dataLayers?: unknown[];
        outcomeMetrics?: unknown[];
      };
      harness?: {
        name?: string;
        phaseCount?: number;
        phases?: unknown[];
        references?: unknown[];
      };
      businessImpact?: unknown[];
      workflowMap?: unknown[];
      integrationReadiness?: unknown[];
      productionReadiness?: unknown[];
      reusablePatterns?: unknown[];
      governancePosture?: unknown[];
      connectorEvidence?: unknown[];
      policyDefinitions?: unknown[];
      budgetCaps?: unknown[];
      approvalQueue?: unknown[];
      auditLog?: Array<Record<string, unknown>>;
      createdIssues?: unknown[];
      slackMessages?: unknown[];
    };
    expect(parsed).toMatchObject({
      deployment: {
        name: 'support-triage-example',
      },
    });
    expect(parsed.readinessSignals).toHaveLength(5);
    expect(parsed.fieldMethod?.workflowName).toBe('Support triage escalation');
    expect(parsed.fieldMethod?.scorecard).toHaveLength(6);
    expect(parsed.fieldMethod?.dataLayers).toHaveLength(4);
    expect(parsed.fieldMethod?.outcomeMetrics).toHaveLength(2);
    expect(parsed.harness?.name).toBe('support-triage-governed-loop');
    expect(parsed.harness?.phaseCount).toBe(4);
    expect(parsed.harness?.phases).toHaveLength(4);
    expect(parsed.harness?.references).toHaveLength(14);
    expect(parsed.businessImpact).toHaveLength(4);
    expect(parsed.workflowMap).toHaveLength(5);
    expect(parsed.integrationReadiness).toHaveLength(3);
    expect(parsed.productionReadiness).toHaveLength(6);
    expect(parsed.reusablePatterns).toHaveLength(5);
    expect(parsed.governancePosture).toHaveLength(5);
    expect(parsed.connectorEvidence).toHaveLength(2);
    expect(parsed.policyDefinitions).toHaveLength(2);
    expect(parsed.budgetCaps).toHaveLength(1);
    expect(parsed.approvalQueue).toHaveLength(1);
    expect(parsed.auditLog).toHaveLength(2);
    expect(parsed.auditLog?.[0]).not.toHaveProperty('args');
    expect(parsed.auditLog?.[0]).not.toHaveProperty('result');
    expect(parsed.auditLog?.[0]).not.toHaveProperty('redacted');
    expect(parsed.createdIssues).toHaveLength(1);
    expect(parsed.slackMessages).toHaveLength(1);
  });

  it('labels local load-test simulations without counting them as readiness evidence', () => {
    const loadTestDeployment: DeploymentDefinition = {
      ...deployment,
      name: 'load-test-example',
      connectors: {
        k6: { name: 'k6' },
      },
    };
    const loadTestTrace: TraceArtifact = {
      id: 'run_load_test',
      createdAt: '2026-06-19T12:00:00.000Z',
      deployment: 'load-test-example',
      events: [
        {
          type: 'tool.call.completed',
          toolName: 'loadtest.run',
          result: {
            mode: 'local',
            status: 'passed',
            targetUrl: 'http://127.0.0.1:8788',
            metrics: {
              httpReqDurationP95Ms: 210,
              httpReqFailedRate: 0.0005,
            },
            thresholds: {
              passed: true,
            },
          },
        },
        {
          type: 'agent.run.completed',
          status: 'completed',
          message: 'Load-test scenario simulated locally. No HTTP request or k6 run was performed.',
        },
      ],
    };
    const bundle = createConsoleExportBundle({
      deployment: loadTestDeployment,
      traces: [loadTestTrace],
      createdAt: '2026-06-19T12:01:00.000Z',
    });
    const parsed = JSON.parse(bundle.dataJson) as {
      readinessSignals?: Array<{ label?: string; status?: string }>;
      businessImpact?: Array<{ label?: string; value?: string; status?: string }>;
      integrationReadiness?: Array<{ label?: string; status?: string; detail?: string }>;
      connectorEvidence?: Array<{ evidenceKind?: string; title?: string; detail?: string }>;
    };
    const html = renderConsolePages({
      deployment: loadTestDeployment,
      traces: [loadTestTrace],
      createdAt: '2026-06-19T12:01:00.000Z',
    }).map((page) => page.html).join('\n');

    expect(parsed.connectorEvidence).toEqual([
      expect.objectContaining({
        evidenceKind: 'simulated',
        title: 'Simulated local load-test scenario for http://127.0.0.1:8788',
      }),
    ]);
    expect(parsed.readinessSignals?.find((item) => item.label === 'Customer Systems')).toMatchObject({
      status: 'warn',
    });
    expect(parsed.businessImpact?.find((item) => item.label === 'System actions')).toMatchObject({
      value: '0',
      status: 'warn',
    });
    expect(parsed.integrationReadiness?.find((item) => item.label === 'k6')).toMatchObject({
      status: 'warn',
      detail: expect.stringContaining('local simulation is not measured readiness evidence'),
    });
    expectTextIncludes(html, [
      'Simulated local load-test scenario',
      'No HTTP request or k6 execution',
      '0 verified system call(s)',
    ]);
  });

  it('does not treat a failed measured load test as passing readiness evidence', () => {
    const loadTestDeployment: DeploymentDefinition = {
      ...deployment,
      name: 'failed-load-test-example',
      connectors: {
        k6: { name: 'k6' },
      },
    };
    const failedTrace: TraceArtifact = {
      id: 'run_failed_load_test',
      createdAt: '2026-06-19T12:00:00.000Z',
      deployment: 'failed-load-test-example',
      events: [{
        type: 'tool.call.completed',
        toolName: 'loadtest.run',
        result: {
          mode: 'k6',
          evidenceKind: 'measured',
          status: 'failed',
          targetUrl: 'http://127.0.0.1:8788',
          metrics: {
            httpReqDurationP95Ms: 900,
            httpReqFailedRate: 0.2,
          },
          thresholds: {
            passed: false,
          },
        },
      }],
    };
    const parsed = JSON.parse(createConsoleExportBundle({
      deployment: loadTestDeployment,
      traces: [failedTrace],
      createdAt: '2026-06-19T12:01:00.000Z',
    }).dataJson) as {
      readinessSignals?: Array<{ label?: string; status?: string }>;
      integrationReadiness?: Array<{ label?: string; status?: string; detail?: string }>;
    };

    expect(parsed.readinessSignals?.find((item) => item.label === 'Customer Systems')).toMatchObject({
      status: 'warn',
    });
    expect(parsed.integrationReadiness?.find((item) => item.label === 'k6')).toMatchObject({
      status: 'warn',
      detail: expect.stringContaining('no passing readiness evidence yet'),
    });
  });

  it('surfaces run failure categories and reasons in operations history', () => {
    const failedTraces: TraceArtifact[] = [
      {
        id: 'run_infra_failure',
        createdAt: '2026-06-26T12:00:00.000Z',
        deployment: 'support-triage-example',
        events: [{
          type: 'agent.run.completed',
          status: 'failed',
          latencyMs: 120,
          costUsd: 0,
          message: 'Ollama request failed at http://127.0.0.1:11434',
        }],
      },
      {
        id: 'run_policy_block',
        createdAt: '2026-06-26T12:01:00.000Z',
        deployment: 'support-triage-example',
        events: [{
          type: 'agent.run.completed',
          status: 'failed',
          latencyMs: 80,
          costUsd: 0,
          message: 'Policy "limit-tool-use" blocked codebase.search: Tool call limit exceeded',
        }],
      },
      {
        id: 'run_tool_error',
        createdAt: '2026-06-26T12:02:00.000Z',
        deployment: 'support-triage-example',
        events: [{
          type: 'agent.run.completed',
          status: 'failed',
          latencyMs: 60,
          costUsd: 0,
          message: 'Tool "codebase.readFile" args $.filePath: Required property is missing',
        }],
      },
    ];
    const charts = renderConsolePages({
      deployment,
      traces: [...failedTraces, trace],
      createdAt: '2026-06-26T12:03:00.000Z',
    }).find((page) => page.fileName === 'charts.html')?.html ?? '';

    expectTextIncludes(charts, [
      'Failure breakdown',
      'Infrastructure failure',
      'Policy block failure',
      'Tool error failure',
      'Ollama request failed at http://127.0.0.1:11434',
      'Policy &quot;limit-tool-use&quot; blocked codebase.search: Tool call limit exceeded',
      'Tool &quot;codebase.readFile&quot; args $.filePath: Required property is missing',
    ]);
  });

  it('scopes dashboard evidence to traces referenced by the latest eval', () => {
    const bundle = createConsoleExportBundle({
      deployment,
      traces: [historicalTrace, trace],
      latestEval: evalArtifact,
      reportMarkdown: '# Report\n\n- Status: passed',
      approvals: [historicalApproval, approval],
      auditLog: [...historicalAuditLog, ...auditLog],
      createdAt: '2026-05-22T12:00:00.000Z',
    });
    const parsed = JSON.parse(bundle.dataJson) as {
      metrics?: {
        traceCount?: number;
        allTraceCount?: number;
        traceScope?: string;
      };
      runs?: Array<{ traceId?: string }>;
      approvalQueue?: unknown[];
      auditLog?: Array<Record<string, unknown>>;
      connectorEvidence?: unknown[];
      createdIssues?: Array<{ id?: string }>;
      slackMessages?: unknown[];
    };

    expect(parsed.metrics).toMatchObject({
      traceCount: 1,
      allTraceCount: 2,
      traceScope: 'latest_eval',
    });
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs?.[0]?.traceId).toBe('run_1');
    expect(parsed.connectorEvidence).toHaveLength(2);
    expect(parsed.createdIssues).toEqual([expect.objectContaining({ id: 'ENG-1' })]);
    expect(parsed.slackMessages).toHaveLength(1);
    expect(parsed.approvalQueue).toHaveLength(1);
    expect(parsed.auditLog).toHaveLength(2);
    expect(parsed.auditLog?.[0]).not.toHaveProperty('args');
    expect(parsed.auditLog?.[0]).not.toHaveProperty('result');
    expect(parsed.auditLog?.[0]).not.toHaveProperty('redacted');
    expect(countCsvRecords(bundle.dashboardCsv, 'run')).toBe(1);
    expect(countCsvRecords(bundle.dashboardCsv, 'issue')).toBe(1);
    expect(countCsvRecords(bundle.dashboardCsv, 'slack')).toBe(1);
    expect(countCsvRecords(bundle.dashboardCsv, 'audit')).toBe(2);
    expect(bundle.dashboardCsv).not.toContain('ENG-0');
    expect(bundle.summaryMarkdown).not.toContain('Historical duplicate billing issue');

    const workbench = renderConsolePages({
      deployment,
      traces: [historicalTrace, trace],
      latestEval: evalArtifact,
      reportMarkdown: '# Report\n\n- Status: passed',
      approvals: [historicalApproval, approval],
      auditLog: [...historicalAuditLog, ...auditLog],
      createdAt: '2026-05-22T12:00:00.000Z',
    }).find((page) => page.fileName === 'workbench.html')?.html ?? '';

    expect(workbench).toContain('1 latest eval run(s)');
    expect(workbench).not.toContain('Historical duplicate billing issue');
  });

  it('falls back to the latest run when no latest eval trace ids exist', () => {
    const bundle = createConsoleExportBundle({
      deployment,
      traces: [historicalTrace, trace],
      createdAt: '2026-05-22T12:00:00.000Z',
    });
    const parsed = JSON.parse(bundle.dataJson) as {
      metrics?: {
        traceCount?: number;
        allTraceCount?: number;
        traceScope?: string;
      };
      runs?: unknown[];
      createdIssues?: unknown[];
      slackMessages?: unknown[];
    };

    expect(parsed.metrics).toMatchObject({
      traceCount: 1,
      allTraceCount: 2,
      traceScope: 'latest_run',
    });
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.createdIssues).toEqual([expect.objectContaining({ id: 'ENG-1' })]);
    expect(parsed.slackMessages).toHaveLength(1);
    expect(bundle.summaryMarkdown).toContain('- Trace scope: latest run (2 stored trace artifacts)');
    expect(bundle.summaryMarkdown).not.toContain('Historical duplicate billing issue');
  });

  it('keeps dashboard sections as ordered rendering strategies', () => {
    expect(dashboardSectionStrategies.map((strategy) => strategy.id)).toEqual([
      'executive-brief',
      'governance-readiness',
      'charts-and-governance-posture',
      'engineer-workbench',
    ]);
    expect(dashboardSectionStrategies.map((strategy) => strategy.fileName)).toEqual([
      'brief.html',
      'readiness.html',
      'charts.html',
      'workbench.html',
    ]);
  });

  it('escapes deployment, event, and report content', () => {
    const pages = renderConsolePages({
      deployment: {
        ...deployment,
        name: '<script>alert("deployment")</script>',
      },
      traces: [{
        ...trace,
        events: [{
          type: 'tool.call.completed',
          toolName: '<script>alert("tool")</script>',
        }],
      }],
      reportMarkdown: '<script>alert("report")</script>',
      createdAt: '2026-05-22T12:00:00.000Z',
    });
    const html = pages.map((page) => page.html).join('\n');

    expect(html).not.toContain('<script>alert("deployment")</script>');
    expect(html).not.toContain('<script>alert("tool")</script>');
    expect(html).not.toContain('<script>alert("report")</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('keeps renderConsole as the overview page', () => {
    const html = renderConsole({
      deployment,
      traces: [trace],
      latestEval: evalArtifact,
      reportMarkdown: '# Report\n\n- Status: passed',
      approvals: [approval],
      auditLog,
      createdAt: '2026-05-22T12:00:00.000Z',
    });

    expect(html).toContain('Overview');
    expect(html).toContain('href="workbench.html"');
    expect(html).not.toContain('Trace Timeline');
  });
});

function expectTextIncludes(value: string, fragments: string[]): void {
  for (const fragment of fragments) {
    expect(value).toContain(fragment);
  }
}

function countCsvRecords(value: string, recordType: string): number {
  return value.split('\n').filter((line) => line.startsWith(`${recordType},`)).length;
}

const deployment: DeploymentDefinition = {
  name: 'support-triage-example',
  environment: 'local',
  providers: {
    mock: { name: 'mock' },
  },
  connectors: {
    customerApi: { name: 'customer-api' },
    github: { name: 'github' },
    slack: { name: 'slack' },
  },
  agents: {
    supportTriage: {
      provider: 'mock',
      instructions: './agents/support-triage.md',
      policies: [
        {
          name: 'limit-tool-scopes',
          description: 'Restrict tool calls to granted permission scopes',
          metadata: {
            kind: 'tool-permissions',
            allowedScopes: ['customer:read', 'ticket:read', 'issues:write', 'slack:write'],
          },
        },
      ],
    },
  },
  policies: [
    {
      name: 'limit-cost',
      description: 'Limit run cost to $0.25',
      metadata: {
        kind: 'budget',
        maxUsd: 0.25,
      },
    },
  ],
  workflow: {
    name: 'Support triage escalation',
    owner: 'support-ops',
    currentState: {
      summary: 'Support manually gathers customer and ticket context',
      baseline: {
        cycleTime: '4h median',
      },
    },
    targetState: {
      summary: 'The agent gathers context and prepares a governed handoff',
      target: '<30m for P1/P2',
    },
    scorecard: {
      volume: 'high',
      manualEffort: 'high',
      fragmentedSystems: ['tickets', 'customer-api', 'slack', 'jira'],
      repeatableDecisions: 'high',
      measurablePain: ['triage-cycle-time', 'handoff-quality'],
      riskBoundary: 'External writes require approval',
    },
  },
  outcomeMetrics: [
    {
      name: 'triage-cycle-time',
      baseline: '4h median',
      target: '<30m',
    },
    {
      name: 'handoff-quality',
      baseline: 'inconsistent notes',
      target: 'all handoffs include evidence',
    },
  ],
  dataLayers: {
    systemOfRecord: ['customer-api', 'ticketing'],
    businessRules: ['./agents/support-triage.md', 'policies'],
    rawIntake: ['ticket.body'],
    feedback: ['approvals', 'audit logs'],
  },
  rollout: {
    stage: 'local',
    stages: ['local', 'sandbox', 'shadow', 'approved-write'],
    next: 'Run against a customer sample with writes disabled',
  },
  harness: {
    name: 'support-triage-governed-loop',
    description: 'Context, decision, approved action, and review phases for governed support escalation',
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
        description: 'Classify renewal risk and escalation path',
        policyRefs: ['deny-pii-leak', 'limit-cost'],
        evalRefs: ['support-triage-dataset'],
        maxSteps: 2,
      },
      {
        name: 'action',
        description: 'Create the issue and Slack handoff only with approval evidence',
        toolRefs: ['issue.create', 'slack.message'],
        policyRefs: ['limit-tool-scopes', 'restrict-environments'],
        artifactRefs: ['audit'],
        maxSteps: 3,
      },
      {
        name: 'review',
        description: 'Run evals and produce the report/dashboard evidence',
        evalRefs: ['support-triage-dataset'],
        artifactRefs: ['eval', 'report', 'dashboard'],
        maxSteps: 1,
      },
    ],
    toolRefs: ['ticket.get', 'customer.get', 'issue.create', 'slack.message'],
    policyRefs: ['deny-pii-leak', 'limit-cost', 'limit-tool-scopes', 'restrict-environments'],
    evalRefs: ['support-triage-dataset'],
    artifactRefs: ['trace', 'audit', 'eval', 'report', 'dashboard'],
    review: {
      evalRefs: ['support-triage-dataset'],
      artifactRefs: ['report', 'dashboard'],
    },
    steer: {
      enabled: true,
      maxAttempts: 1,
      triggerRefs: ['support-triage-dataset', 'deny-pii-leak'],
    },
  },
};

const trace: TraceArtifact = {
  id: 'run_1',
  createdAt: '2026-05-22T12:00:00.000Z',
  deployment: 'support-triage-example',
  events: [
    { type: 'agent.run.started', provider: 'mock' },
    { type: 'provider.step.tool_call', provider: 'mock', stepIndex: 0, toolName: 'ticket.get' },
    { type: 'tool.call.completed', toolName: 'ticket.get', latencyMs: 5 },
    { type: 'tool.call.completed', toolName: 'customer.get', latencyMs: 7 },
    {
      type: 'tool.call.completed',
      toolName: 'issue.create',
      args: { title: 'Escalate company billing outage' },
      result: {
        tracker: 'jira',
        id: 'local_jira_1',
        key: 'ENG-1',
        title: 'Escalate company billing outage',
        url: 'https://jira.local/browse/ENG-1',
        mode: 'local',
        projectKey: 'ENG',
      },
      latencyMs: 9,
    },
    {
      type: 'tool.call.completed',
      toolName: 'slack.message',
      args: {
        channel: '#support-escalations',
        text: 'company Bank needs high-priority escalation',
      },
      result: {
        ok: true,
        mode: 'local',
        channel: '#support-escalations',
        text: 'company Bank needs high-priority escalation',
        ticketId: 'tick_1001',
        ts: '2026-05-22T12:00:01.000Z',
      },
      latencyMs: 4,
    },
    { type: 'policy.evaluated', policy: 'deny-pii-leak', allowed: true },
    {
      type: 'policy.evaluated',
      policy: 'require-approval',
      phase: 'beforeToolCall',
      toolName: 'issue.create',
      allowed: false,
      approvalRequired: true,
      reason: 'Issue creation requires approval',
    },
    { type: 'agent.run.completed', status: 'completed', latencyMs: 20, costUsd: 0, policyViolations: [] },
  ],
};

const historicalTrace: TraceArtifact = {
  id: 'run_old',
  createdAt: '2026-05-22T11:00:00.000Z',
  deployment: 'support-triage-example',
  events: [
    { type: 'agent.run.started', provider: 'mock' },
    { type: 'tool.call.completed', toolName: 'ticket.get', latencyMs: 6 },
    { type: 'tool.call.completed', toolName: 'customer.get', latencyMs: 8 },
    {
      type: 'tool.call.completed',
      toolName: 'issue.create',
      args: { title: 'Historical duplicate billing issue' },
      result: {
        tracker: 'jira',
        id: 'local_jira_old',
        key: 'ENG-0',
        title: 'Historical duplicate billing issue',
        url: 'https://jira.local/browse/ENG-0',
        mode: 'local',
        projectKey: 'ENG',
      },
      latencyMs: 10,
    },
    {
      type: 'tool.call.completed',
      toolName: 'slack.message',
      args: {
        channel: '#support-escalations',
        text: 'Historical duplicate Slack handoff',
      },
      result: {
        ok: true,
        mode: 'local',
        channel: '#support-escalations',
        text: 'Historical duplicate Slack handoff',
        ticketId: 'tick_old',
        ts: '2026-05-22T11:00:01.000Z',
      },
      latencyMs: 5,
    },
    { type: 'policy.evaluated', policy: 'deny-pii-leak', allowed: true },
    {
      type: 'policy.evaluated',
      policy: 'require-approval',
      phase: 'beforeToolCall',
      toolName: 'issue.create',
      allowed: false,
      approvalRequired: true,
      reason: 'Issue creation requires approval',
    },
    {
      type: 'agent.run.completed',
      status: 'completed',
      latencyMs: 29,
      costUsd: 0,
      message: 'Historical duplicate final answer',
      policyViolations: [],
    },
  ],
};

const evalArtifact: EvalArtifact = {
  id: 'eval_1',
  createdAt: '2026-05-22T12:01:00.000Z',
  deployment: 'support-triage-example',
  status: 'passed',
  results: [
    {
      scope: 'deployment',
      name: 'support-triage-dataset',
      status: 'passed',
      cases: [
        {
          name: 'enterprise billing escalation',
          status: 'passed',
          input: { ticketId: 'tick_1001' },
          toolCalls: ['ticket.get', 'customer.get', 'issue.create', 'slack.message', 'ticket.escalate'],
          traceId: 'run_1',
          assertions: [],
        },
      ],
    },
  ],
};

const historicalApproval: ApprovalArtifact = {
  id: 'appr_old_issue_create',
  fingerprint: 'fingerprint_old_issue_create',
  status: 'approved',
  createdAt: '2026-05-22T11:00:00.500Z',
  updatedAt: '2026-05-22T11:00:02.000Z',
  deployment: 'support-triage-example',
  environment: 'local',
  agent: 'supportTriage',
  runId: 'run_old',
  traceId: 'run_old',
  policy: 'require-approval',
  phase: 'beforeToolCall',
  toolName: 'issue.create',
  args: { title: 'Historical duplicate billing issue' },
  reason: 'Issue creation requires approval',
  requestedBy: 'agent',
  decidedAt: '2026-05-22T11:00:02.000Z',
  decidedBy: 'fde',
  decisionReason: 'Approved historical duplicate',
};

const approval: ApprovalArtifact = {
  id: 'appr_issue_create',
  fingerprint: 'fingerprint_issue_create',
  status: 'approved',
  createdAt: '2026-05-22T12:00:00.500Z',
  updatedAt: '2026-05-22T12:00:02.000Z',
  deployment: 'support-triage-example',
  environment: 'local',
  agent: 'supportTriage',
  runId: 'run_1',
  traceId: 'run_1',
  policy: 'require-approval',
  phase: 'beforeToolCall',
  toolName: 'issue.create',
  args: { title: 'Escalate company billing outage' },
  reason: 'Issue creation requires approval',
  requestedBy: 'agent',
  decidedAt: '2026-05-22T12:00:02.000Z',
  decidedBy: 'fde',
  decisionReason: 'Approved for renewal-risk handoff',
};

const historicalAuditLog: AuditLogEntry[] = [
  {
    id: 'audit_old_1',
    createdAt: '2026-05-22T11:00:00.500Z',
    deployment: 'support-triage-example',
    environment: 'local',
    agent: 'supportTriage',
    runId: 'run_old',
    traceId: 'run_old',
    actor: 'agent',
    action: 'approval.requested',
    outcome: 'requested',
    toolName: 'issue.create',
    policy: 'require-approval',
    approvalId: 'appr_old_issue_create',
    message: 'Historical duplicate approval requested',
  },
  {
    id: 'audit_old_2',
    createdAt: '2026-05-22T11:00:02.000Z',
    deployment: 'support-triage-example',
    environment: 'local',
    agent: 'supportTriage',
    runId: 'run_old',
    traceId: 'run_old',
    actor: 'fde',
    action: 'approval.approved',
    outcome: 'approved',
    toolName: 'issue.create',
    policy: 'require-approval',
    approvalId: 'appr_old_issue_create',
    message: 'Approved historical duplicate',
  },
];

const auditLog: AuditLogEntry[] = [
  {
    id: 'audit_1',
    createdAt: '2026-05-22T12:00:00.500Z',
    deployment: 'support-triage-example',
    environment: 'local',
    agent: 'supportTriage',
    runId: 'run_1',
    traceId: 'run_1',
    actor: 'agent',
    action: 'approval.requested',
    outcome: 'requested',
    toolName: 'issue.create',
    policy: 'require-approval',
    approvalId: 'appr_issue_create',
    message: 'Issue creation requires approval',
  },
  {
    id: 'audit_2',
    createdAt: '2026-05-22T12:00:02.000Z',
    deployment: 'support-triage-example',
    environment: 'local',
    agent: 'supportTriage',
    runId: 'run_1',
    traceId: 'run_1',
    actor: 'fde',
    action: 'approval.approved',
    outcome: 'approved',
    toolName: 'issue.create',
    policy: 'require-approval',
    approvalId: 'appr_issue_create',
    message: 'Approved for renewal-risk handoff',
  },
];
