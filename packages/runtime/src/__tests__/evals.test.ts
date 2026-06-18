import { mkdtemp, mkdir, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  asRecord,
  defineAgent,
  defineDeployment,
  defineEval,
  definePolicy,
  defineTool,
  expectedToolCall,
  getString,
  noPolicyViolation,
  type DeploymentDefinition,
  type ProviderPlanContext,
  type ProviderStep,
  type ProviderToolResult,
  type ToolDefinition,
} from '@fdekit/core';
import { runEvals } from '../evals/index.js';
import { renderMacroEvalReport, runMacroEvals } from '../macro-evals/index.js';

describe('runEvals', () => {
  it('runs dataset-backed agent evals and writes per-case traces', async () => {
    const projectDir = await createEvalProject();
    const artifact = await runEvals({
      deployment: createSupportTriageDeployment(),
      projectDir,
      writeTraces: true,
    });

    expect(artifact.status).toBe('passed');
    expect(artifact.results).toHaveLength(1);
    expect(artifact.results[0]).toMatchObject({
      scope: 'deployment',
      name: 'support-triage-dataset',
      status: 'passed',
    });

    const cases = artifact.results[0].cases ?? [];
    expect(cases).toHaveLength(2);
    expect(cases.map((evalCase) => evalCase.status)).toEqual(['passed', 'passed']);

    const escalationCase = cases.find((evalCase) => evalCase.name === 'enterprise billing escalation');
    expect(escalationCase?.toolCalls).toEqual([
      'ticket.get',
      'customer.get',
      'issue.create',
      'slack.message',
      'ticket.escalate',
    ]);

    const standardCase = cases.find((evalCase) => evalCase.name === 'standard support triage');
    expect(standardCase?.toolCalls).toEqual(['ticket.get', 'customer.get']);

    for (const evalCase of cases) {
      expect(evalCase.traceId).toBeTypeOf('string');
      const trace = JSON.parse(await readFile(
        path.join(projectDir, 'artifacts', 'traces', `${evalCase.traceId}.json`),
        'utf8',
      )) as { id?: string; events?: unknown[] };

      expect(trace.id).toBe(evalCase.traceId);
      expect(trace.events?.length).toBeGreaterThan(0);
    }
  });

  it('writes failed traces when a policy blocks an eval case', async () => {
    const projectDir = await createEvalProject();
    const deployment = createSupportTriageDeployment();
    deployment.policies = [
      definePolicy({
        name: 'deny-ticket-read',
        beforeToolCall(toolName) {
          return toolName === 'ticket.get'
            ? { allowed: false, reason: 'Ticket reads are disabled' }
            : true;
        },
      }),
    ];

    const artifact = await runEvals({
      deployment,
      projectDir,
      writeTraces: true,
    });

    expect(artifact.status).toBe('failed');
    const cases = artifact.results[0].cases ?? [];
    expect(cases).toHaveLength(2);

    for (const evalCase of cases) {
      expect(evalCase).toMatchObject({
        status: 'failed',
        traceId: expect.any(String),
      });
      const trace = JSON.parse(await readFile(
        path.join(projectDir, 'artifacts', 'traces', `${evalCase.traceId}.json`),
        'utf8',
      )) as { events?: Array<Record<string, unknown>> };
      expect(trace.events?.at(-1)).toMatchObject({
        type: 'agent.run.completed',
        status: 'failed',
      });
    }
  });

  it('builds macro eval patterns from traces and lower-level eval labels', () => {
    const artifact = runMacroEvals({
      deployment: createSupportTriageDeployment(),
      traces: [
        createTrace({
          id: 'trace_escalation_missing_1',
          tools: ['ticket.get', 'customer.get'],
          status: 'completed',
        }),
        createTrace({
          id: 'trace_escalation_missing_2',
          tools: ['ticket.get', 'customer.get'],
          status: 'completed',
        }),
        createTrace({
          id: 'trace_healthy_1',
          tools: ['ticket.get', 'customer.get', 'issue.create', 'slack.message', 'ticket.escalate'],
          status: 'completed',
        }),
      ],
      evalArtifact: {
        id: 'eval_123',
        createdAt: '2026-05-26T12:00:00.000Z',
        deployment: 'test-support-triage',
        status: 'failed',
        results: [
          {
            scope: 'deployment',
            name: 'support-triage-dataset',
            status: 'failed',
            cases: [
              {
                name: 'enterprise billing escalation 1',
                status: 'failed',
                input: { ticketId: 'tick_1001' },
                expected: { caseType: 'enterprise escalation', escalation: true },
                metadata: { caseType: 'enterprise escalation' },
                toolCalls: ['ticket.get', 'customer.get'],
                traceId: 'trace_escalation_missing_1',
                assertions: [
                  {
                    passed: false,
                    message: 'Expected escalation tools to be called',
                    score: 0,
                  },
                ],
              },
              {
                name: 'enterprise billing escalation 2',
                status: 'failed',
                input: { ticketId: 'tick_1003' },
                expected: { caseType: 'enterprise escalation', escalation: true },
                metadata: { caseType: 'enterprise escalation' },
                toolCalls: ['ticket.get', 'customer.get'],
                traceId: 'trace_escalation_missing_2',
                assertions: [
                  {
                    passed: false,
                    message: 'Expected escalation tools to be called',
                    score: 0,
                  },
                ],
              },
              {
                name: 'healthy escalation',
                status: 'passed',
                input: { ticketId: 'tick_1004' },
                expected: { caseType: 'enterprise escalation', escalation: true },
                metadata: { caseType: 'enterprise escalation' },
                toolCalls: ['ticket.get', 'customer.get', 'issue.create', 'slack.message', 'ticket.escalate'],
                traceId: 'trace_healthy_1',
                assertions: [
                  {
                    passed: true,
                    message: 'Observed escalation tools',
                    score: 1,
                  },
                ],
              },
            ],
          },
        ],
      },
      minFrequency: 2,
      createdAt: '2026-05-26T12:01:00.000Z',
    });

    expect(artifact.source).toMatchObject({
      traceCount: 3,
      evalArtifactId: 'eval_123',
      minFrequency: 2,
    });
    expect(artifact.traceDocuments).toHaveLength(3);
    expect(artifact.traceDocuments[0].compactDocument).toContain('case_type: enterprise escalation');
    expect(artifact.patterns[0]).toMatchObject({
      behaviorPattern: 'Escalation Routing',
      frequency: 3,
      severity: 'high',
    });
    expect(artifact.patterns[0].evalFindings).toContainEqual({
      category: 'escalation routing',
      count: 2,
    });
    expect(artifact.focusPattern?.recommendedInspection).toContain('trace_');

    const report = renderMacroEvalReport(artifact);
    expect(report).toContain('# test-support-triage Macro Eval Report');
    expect(report).toContain('## Behavior Patterns');
    expect(report).toContain('Escalation Routing');
  });

  it('infers macro behavior signals from tool tags instead of connector names', () => {
    const deployment = defineDeployment({
      name: 'custom-escalation',
      providers: {
        mock: { name: 'mock' },
      },
      agents: {
        triage: defineAgent({
          provider: 'mock',
          instructions: 'Route custom escalations',
          tools: [
            defineTool({
              name: 'support.routeCritical',
              category: 'workflow',
              tags: ['action', 'escalation'],
              handler() {
                return { ok: true };
              },
            }),
          ],
        }),
      },
    });

    const artifact = runMacroEvals({
      deployment,
      traces: [
        createTrace({
          id: 'trace_custom_route',
          tools: ['support.routeCritical'],
          status: 'completed',
        }),
      ],
      minFrequency: 1,
      createdAt: '2026-05-26T12:02:00.000Z',
    });

    expect(artifact.traceDocuments[0].behaviorSignals).toContain('escalation routing');
    expect(artifact.patterns[0].behaviorPattern).toBe('Escalation Routing');
  });
});

function createTrace(options: {
  id: string;
  tools: string[];
  status: string;
}) {
  return {
    id: options.id,
    createdAt: '2026-05-26T12:00:00.000Z',
    deployment: 'test-support-triage',
    events: [
      { type: 'agent.run.started', agent: 'supportTriage' },
      ...options.tools.flatMap((toolName) => [
        { type: 'tool.call.started', toolName },
        { type: 'tool.call.completed', toolName, result: { ok: true }, latencyMs: 1 },
      ]),
      {
        type: 'agent.run.completed',
        status: options.status,
        message: 'Done',
        toolCalls: options.tools,
        policyViolations: [],
      },
    ],
  };
}

async function createEvalProject(): Promise<string> {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'fdekit-runtime-evals-'));
  const evalsDir = path.join(projectDir, 'evals');
  await mkdir(evalsDir, { recursive: true });
  await writeFile(path.join(evalsDir, 'support-triage.json'), JSON.stringify([
    {
      name: 'enterprise billing escalation',
      input: { ticketId: 'tick_1001' },
      expected: {
        escalation: true,
        customerId: 'cus_company',
        priority: 'high',
        issueType: 'billing',
      },
    },
    {
      name: 'standard support triage',
      input: { ticketId: 'tick_1002' },
      expected: {
        escalation: false,
        customerId: 'cus_globex',
        priority: 'normal',
      },
    },
  ]));

  return projectDir;
}

function createSupportTriageDeployment(): DeploymentDefinition {
  return defineDeployment({
    name: 'test-support-triage',
    providers: {
      mock: {
        name: 'mock',
        options: {
          planner: supportTriageTestPlanner,
        },
      },
    },
    agents: {
      supportTriage: defineAgent({
        provider: 'mock',
        instructions: 'Triage support tickets and escalate risky customer cases',
        tools: createSupportTriageTools(),
      }),
    },
    evals: [
      defineEval({
        name: 'support-triage-dataset',
        agent: 'supportTriage',
        dataset: './evals/support-triage.json',
        maxSteps: 8,
        assertions: [
          expectedToolCall('ticket.get'),
          expectedToolCall('customer.get'),
          noPolicyViolation(),
        ],
      }),
    ],
  });
}

function createSupportTriageTools(): ToolDefinition[] {
  const tickets: Record<string, Record<string, unknown>> = {
    tick_1001: {
      id: 'tick_1001',
      customerId: 'cus_company',
      title: 'Billing issue blocks renewal',
      body: 'The procurement team cannot complete billing before renewal',
      priority: 'high',
      issueType: 'billing',
      tags: ['billing', 'renewal'],
    },
    tick_1002: {
      id: 'tick_1002',
      customerId: 'cus_globex',
      title: 'Question about dashboard filters',
      body: 'The support team needs help with an analytics filter',
      priority: 'normal',
      issueType: 'analytics',
      tags: ['how-to'],
    },
  };
  const customers: Record<string, Record<string, unknown>> = {
    cus_company: {
      id: 'cus_company',
      name: 'company Bank',
      tier: 'enterprise',
    },
    cus_globex: {
      id: 'cus_globex',
      name: 'Globex',
      tier: 'growth',
    },
  };

  return [
    defineTool<{ ticketId: string }>({
      name: 'ticket.get',
      category: 'context',
      tags: ['ticket', 'read'],
      handler(args) {
        return tickets[args.ticketId] ?? null;
      },
    }),
    defineTool<{ customerId: string }>({
      name: 'customer.get',
      category: 'context',
      tags: ['customer', 'read'],
      handler(args) {
        return customers[args.customerId] ?? null;
      },
    }),
    defineTool({
      name: 'issue.create',
      category: 'issue',
      tags: ['action', 'escalation', 'issue'],
      handler(args) {
        return { id: 'iss_123', ...args };
      },
    }),
    defineTool({
      name: 'slack.message',
      category: 'messaging',
      tags: ['action', 'escalation', 'message'],
      handler(args) {
        return { ok: true, ts: '1710000000.000001', ...args };
      },
    }),
    defineTool<{ ticketId: string; reason: string }>({
      name: 'ticket.escalate',
      category: 'escalation',
      tags: ['action', 'escalation', 'ticket'],
      handler(args) {
        return { id: args.ticketId, status: 'escalated', reason: args.reason };
      },
    }),
  ];
}

function supportTriageTestPlanner(context: ProviderPlanContext): ProviderStep {
  const ticketId = getString(context.input.ticketId);

  if (!ticketId) {
    return {
      type: 'final',
      message: 'No ticket id was provided',
    };
  }

  const ticketCall = findToolResult(context.toolResults, 'ticket.get');

  if (!ticketCall) {
    return {
      type: 'tool_call',
      toolName: 'ticket.get',
      args: { ticketId },
    };
  }

  const ticket = asRecord(ticketCall.result);
  const customerId = getString(ticket.customerId);
  const customerCall = findToolResult(context.toolResults, 'customer.get');

  if (customerId && !customerCall) {
    return {
      type: 'tool_call',
      toolName: 'customer.get',
      args: { customerId },
    };
  }

  const customer = customerCall ? asRecord(customerCall.result) : {};
  const triage = classifySupportCase(ticket, customer);

  if (!triage.shouldEscalate) {
    return {
      type: 'final',
      message: `${triage.customerName} ticket ${ticketId} can stay in standard support triage; reason: ${triage.reason}`,
    };
  }

  if (!findToolResult(context.toolResults, 'issue.create')) {
    return {
      type: 'tool_call',
      toolName: 'issue.create',
      args: {
        ticketId,
        title: `[${triage.priority.toUpperCase()}] ${getString(ticket.title) ?? `Support ticket ${ticketId}`}`,
        body: `Customer: ${triage.customerName}\nReason: ${triage.reason}`,
        priority: triage.priority,
      },
    };
  }

  if (!findToolResult(context.toolResults, 'slack.message')) {
    return {
      type: 'tool_call',
      toolName: 'slack.message',
      args: {
        channel: '#support-escalations',
        ticketId,
        text: `${triage.customerName} needs escalation for ${triage.reason}`,
      },
    };
  }

  if (!findToolResult(context.toolResults, 'ticket.escalate')) {
    return {
      type: 'tool_call',
      toolName: 'ticket.escalate',
      args: {
        ticketId,
        reason: triage.reason,
      },
    };
  }

  return {
    type: 'final',
    message: `${triage.customerName} ticket ${ticketId} was escalated as ${triage.priority} priority because ${triage.reason}`,
  };
}

function findToolResult(toolResults: ProviderToolResult[], toolName: string): ProviderToolResult | undefined {
  return toolResults.find((result) => result.name === toolName);
}

function classifySupportCase(ticket: Record<string, unknown>, customer: Record<string, unknown>) {
  const priority = getString(ticket.priority) ?? 'normal';
  const tags = Array.isArray(ticket.tags) ? ticket.tags.map((tag) => String(tag).toLowerCase()) : [];
  const text = `${getString(ticket.title) ?? ''} ${getString(ticket.body) ?? ''} ${tags.join(' ')}`.toLowerCase();
  const tier = getString(customer.tier)?.toLowerCase();
  const shouldEscalate = priority === 'high'
    || tier === 'enterprise'
    || text.includes('billing')
    || text.includes('renewal')
    || text.includes('production')
    || text.includes('outage');
  const reasons = [
    tier === 'enterprise' ? 'enterprise customer' : '',
    text.includes('billing') ? 'billing impact' : '',
    text.includes('renewal') ? 'renewal risk' : '',
    priority === 'high' ? 'high-priority ticket' : '',
  ].filter(Boolean);

  return {
    shouldEscalate,
    priority: shouldEscalate ? 'high' : 'normal',
    customerName: getString(customer.name) ?? 'Unknown customer',
    reason: reasons.join(', ') || 'standard support request',
  };
}
