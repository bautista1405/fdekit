import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  asRecord,
  defineAgent,
  defineDeployment,
  defineGovernance,
  definePolicy,
  defineTool,
  denyPIILeak,
  limitToolScopes,
  limitToolUse,
  requireApproval,
  restrictEnvironments,
  getString,
  type DeploymentDefinition,
  type ProviderPlanContext,
  type ProviderStep,
  type ProviderToolResult,
  type ToolDefinition,
} from '@fdekit/core';
import { runAgent } from '../agents/index.js';
import { approveApproval, readAuditLog } from '../governance/index.js';

describe('runAgent', () => {
  it('runs a deterministic support escalation loop with tool calls and traces', async () => {
    const deployment = createSupportTriageDeployment();
    const projectDir = await mkRunProjectDir();

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
    });

    expect(result.status).toBe('completed');
    expect(result.provider).toBe('mock');
    expect(result.finalAnswer).toContain('was escalated');
    expect(result.policyViolations).toEqual([]);
    expect(result.toolCalls.map((call) => call.name)).toEqual([
      'ticket.get',
      'customer.get',
      'issue.create',
      'slack.message',
      'ticket.escalate',
    ]);
    expect(result.trace.events.map((event) => event.type)).toContain('provider.step.tool_call');
    expect(result.trace.events.at(-1)).toMatchObject({
      type: 'agent.run.completed',
      status: 'completed',
    });
  });

  it('keeps standard support tickets out of the escalation path', async () => {
    const deployment = createSupportTriageDeployment();
    const projectDir = await mkRunProjectDir();

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1002' },
    });

    expect(result.status).toBe('completed');
    expect(result.finalAnswer).toContain('standard support triage');
    expect(result.toolCalls.map((call) => call.name)).toEqual([
      'ticket.get',
      'customer.get',
    ]);
  });

  it('runs a provider adapter supplied by provider config', async () => {
    const projectDir = await mkRunProjectDir();
    const deployment = defineDeployment({
      name: 'test-config-provider-runtime',
      environment: 'local',
      providers: {
        custom: {
          name: 'custom',
          model: 'custom-model',
          runtime: (config) => ({
            name: config.name,
            planNextStep: () => ({
              type: 'final',
              message: `Config runtime completed with ${config.model}`,
            }),
          }),
        },
      },
      agents: {
        customAgent: defineAgent({
          provider: 'custom',
          instructions: 'Use the custom provider',
        }),
      },
    });

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'customAgent',
      input: { task: 'say hello' },
    });

    expect(result.status).toBe('completed');
    expect(result.provider).toBe('custom');
    expect(result.finalAnswer).toBe('Config runtime completed with custom-model');
  });

  it('runs a provider adapter supplied by a runtime registry', async () => {
    const projectDir = await mkRunProjectDir();
    const deployment = defineDeployment({
      name: 'test-registry-provider-runtime',
      environment: 'local',
      providers: {
        custom: {
          name: 'registered-provider',
          model: 'registered-model',
        },
      },
      agents: {
        customAgent: defineAgent({
          provider: 'custom',
          instructions: 'Use the registered provider',
        }),
      },
    });

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'customAgent',
      input: { task: 'say hello' },
      providerRegistry: {
        'registered-provider': (config) => ({
          name: config.name,
          planNextStep: () => ({
            type: 'final',
            message: `Registry runtime completed with ${config.model}`,
          }),
        }),
      },
    });

    expect(result.status).toBe('completed');
    expect(result.provider).toBe('registered-provider');
    expect(result.finalAnswer).toBe('Registry runtime completed with registered-model');
  });

  it('returns tool handler failures to the provider so the loop can recover', async () => {
    const projectDir = await mkRunProjectDir();
    const seenToolResults: ProviderToolResult[][] = [];
    const deployment = defineDeployment({
      name: 'recoverable-tool-error',
      environment: 'local',
      providers: {
        recovering: {
          name: 'recovering',
          runtime: {
            name: 'recovering',
            planNextStep(context) {
              seenToolResults.push([...context.toolResults]);

              if (!findToolResult(context.toolResults, 'customer.get')) {
                return {
                  type: 'tool_call',
                  toolName: 'customer.get',
                  args: { customerId: 'tick_1001' },
                };
              }

              if (!findToolResult(context.toolResults, 'ticket.get')) {
                return {
                  type: 'tool_call',
                  toolName: 'ticket.get',
                  args: { ticketId: 'tick_1001' },
                };
              }

              return {
                type: 'final',
                message: 'Recovered after fetching the ticket first',
              };
            },
          },
        },
      },
      agents: {
        supportTriage: defineAgent({
          provider: 'recovering',
          instructions: 'Recover from a bad customer lookup by fetching the ticket first',
          tools: [
            defineTool<{ customerId: string }>({
              name: 'customer.get',
              handler(args) {
                throw new Error(`Customer API request failed: 404 Not Found (${args.customerId})`);
              },
            }),
            defineTool<{ ticketId: string }>({
              name: 'ticket.get',
              handler(args) {
                return { id: args.ticketId, customerId: 'cus_company' };
              },
            }),
          ],
        }),
      },
    });

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
      maxSteps: 4,
    });

    expect(result.status).toBe('completed');
    expect(result.finalAnswer).toBe('Recovered after fetching the ticket first');
    expect(result.toolCalls.map((call) => call.name)).toEqual(['customer.get', 'ticket.get']);
    expect(result.toolCalls[0]).toMatchObject({
      name: 'customer.get',
      is_error: true,
      result: {
        error: {
          name: 'Error',
          message: 'Customer API request failed: 404 Not Found (tick_1001)',
        },
      },
    });
    expect(result.toolCalls[1]).not.toHaveProperty('is_error');

    const recoveredContext = seenToolResults.find((toolResults) => toolResults.length === 1);
    expect(recoveredContext?.[0]).toMatchObject({
      name: 'customer.get',
      is_error: true,
    });
    expect(result.trace.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'tool.call.failed',
        toolName: 'customer.get',
        is_error: true,
      }),
      expect.objectContaining({
        type: 'tool.call.completed',
        toolName: 'ticket.get',
      }),
    ]));

    const audit = await readAuditLog(projectDir);
    expect(audit.find((entry) => entry.action === 'tool.call.failed')).toMatchObject({
      outcome: 'failed',
      toolName: 'customer.get',
    });
  });

  it('asks for an explicit adapter when a non-mock provider config has no runtime', async () => {
    const projectDir = await mkRunProjectDir();
    const deployment = defineDeployment({
      name: 'test-missing-provider-runtime',
      environment: 'local',
      providers: {
        custom: {
          name: 'custom',
          model: 'custom-model',
        },
      },
      agents: {
        customAgent: defineAgent({
          provider: 'custom',
          instructions: 'Use the custom provider',
        }),
      },
    });

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'customAgent',
      input: { task: 'say hello' },
    })).rejects.toThrow('Provider "custom" does not have a runtime adapter');
  });

  it('blocks tool execution when a policy denies a provider-planned call', async () => {
    const deployment = createSupportTriageDeployment([
      definePolicy({
        name: 'deny-escalation',
        beforeToolCall(toolName) {
          return toolName === 'ticket.escalate'
            ? { allowed: false, reason: 'Escalation queue is frozen' }
            : true;
        },
      }),
    ]);
    const projectDir = await mkRunProjectDir();

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
    })).rejects.toThrow('Policy "deny-escalation" blocked ticket.escalate');
  });

  it('passes tool permission scopes into policy checks', async () => {
    const deployment = createSupportTriageDeployment([
      limitToolScopes({
        allowed: ['ticket:read', 'customer:read'],
        requireScopes: true,
      }),
    ]);
    const projectDir = await mkRunProjectDir();

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
    })).rejects.toThrow('requires ungranted scope(s): issues:write');

    const audit = await readAuditLog(projectDir);
    expect(audit.find((entry) => entry.action === 'policy.blocked')).toMatchObject({
      policy: 'limit-tool-scopes',
      toolName: 'issue.create',
    });
  });

  it('passes deployment environment into policy checks', async () => {
    const deployment = createSupportTriageDeployment([
      restrictEnvironments({
        allowed: ['staging'],
        tools: ['issue.create'],
      }),
    ]);
    const projectDir = await mkRunProjectDir();

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
    })).rejects.toThrow('Policy "restrict-environments" blocked issue.create');

    const audit = await readAuditLog(projectDir);
    expect(audit.find((entry) => entry.policy === 'restrict-environments' && entry.outcome === 'blocked')).toMatchObject({
      outcome: 'blocked',
      toolName: 'issue.create',
    });
  });

  it('enforces first-class governance settings', async () => {
    const deployment = createSupportTriageDeployment();
    deployment.governance = defineGovernance({
      audit: {
        enabled: true,
        retentionDays: 30,
      },
      permissions: {
        requireScopes: true,
        allowedScopes: ['ticket:read', 'customer:read'],
      },
      environments: {
        allowed: ['local', 'staging'],
        tools: ['issue.create'],
      },
      budgets: [
        {
          scope: 'deployment',
          maxUsd: 0.25,
        },
      ],
      dataProtection: {
        denyPII: true,
        redactSecrets: true,
      },
    });
    const projectDir = await mkRunProjectDir();

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
    })).rejects.toThrow('requires ungranted scope(s): issues:write');

    const audit = await readAuditLog(projectDir);
    expect(audit.find((entry) => entry.action === 'policy.blocked')).toMatchObject({
      policy: 'limit-tool-scopes',
      toolName: 'issue.create',
    });
  });

  it('pauses for approval gates, records audit logs, and resumes after approval', async () => {
    const deployment = createSupportTriageDeployment([
      requireApproval({
        tools: ['issue.create'],
        reason: 'Issue creation needs customer approval',
      }),
    ]);
    const projectDir = await mkRunProjectDir();

    const pending = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
    });

    expect(pending.status).toBe('waiting_approval');
    expect(pending.toolCalls.map((call) => call.name)).toEqual(['ticket.get', 'customer.get']);
    expect(pending.policyViolations).toHaveLength(1);
    expect(pending.approvals).toHaveLength(1);
    expect(pending.approvals[0]).toMatchObject({
      status: 'pending',
      policy: 'require-approval',
      toolName: 'issue.create',
      reason: 'Issue creation needs customer approval',
    });

    await approveApproval(projectDir, pending.approvals[0].id, {
      actor: 'fde',
      reason: 'Customer approved issue creation',
    });

    const completed = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
    });

    expect(completed.status).toBe('completed');
    expect(completed.approvals).toHaveLength(1);
    expect(completed.approvals[0]).toMatchObject({
      id: pending.approvals[0].id,
      status: 'approved',
      decidedBy: 'fde',
    });
    expect(completed.toolCalls.map((call) => call.name)).toEqual([
      'ticket.get',
      'customer.get',
      'issue.create',
      'slack.message',
      'ticket.escalate',
    ]);

    const audit = await readAuditLog(projectDir);
    expect(audit.map((entry) => entry.action)).toEqual(expect.arrayContaining([
      'approval.requested',
      'approval.approved',
      'approval.satisfied',
      'agent.run.completed',
    ]));
    expect(audit.find((entry) => entry.action === 'approval.requested')).toMatchObject({
      approvalId: pending.approvals[0].id,
      actor: 'agent',
    });
  });

  it('redacts secret-like values before writing traces and audit metadata', async () => {
    const deployment = createSupportTriageDeployment();
    const projectDir = await mkRunProjectDir();

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: {
        ticketId: 'tick_1001',
        token: 'sk-abcdefghijklmnop1234567890',
      },
    });
    const started = result.trace.events.find((event) => event.type === 'agent.run.started');
    const ticketCall = result.trace.events.find((event) => event.type === 'tool.call.completed' && event.toolName === 'ticket.get');
    const audit = await readAuditLog(projectDir);

    expect(JSON.stringify(started)).not.toContain('sk-abcdefghijklmnop1234567890');
    expect(JSON.stringify(ticketCall)).not.toContain('sk-zyxwvutsrqponmlkjihgfedcba');
    expect(JSON.stringify(audit)).not.toContain('sk-abcdefghijklmnop1234567890');
    expect(JSON.stringify(audit)).not.toContain('sk-zyxwvutsrqponmlkjihgfedcba');
  });

  it('keeps runtime strict mode opt-in and blocks incomplete tool metadata when enabled', async () => {
    const deployment = createSupportTriageDeployment();
    const projectDir = await mkRunProjectDir();

    const standard = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1002' },
    });

    expect(standard.status).toBe('completed');

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1002' },
      strict: true,
    })).rejects.toThrow('Tool "ticket.get" must declare argsSchema in strict mode');

    const audit = await readAuditLog(projectDir);
    expect(audit.find((entry) => entry.action === 'runtime.edge.catalog.blocked')).toMatchObject({
      policy: 'runtime-edge',
      outcome: 'blocked',
    });
  });

  it('blocks malformed tool args at the runtime edge before the handler runs', async () => {
    const projectDir = await mkRunProjectDir();
    let handled = false;
    const deployment = defineDeployment({
      name: 'strict-schema-edge',
      environment: 'local',
      providers: {
        mock: {
          name: 'mock',
          options: {
            planner() {
              return {
                type: 'tool_call',
                toolName: 'edge.checked',
                args: {},
              };
            },
          },
        },
      },
      agents: {
        edge: defineAgent({
          provider: 'mock',
          instructions: 'Exercise strict runtime edge gates',
          tools: [
            defineTool<{ ticketId: string }>({
              name: 'edge.checked',
              scopes: ['edge:write'],
              environments: ['local'],
              argsSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                  ticketId: { type: 'string' },
                },
                additionalProperties: false,
              },
              handler() {
                handled = true;
                return { ok: true };
              },
            }),
          ],
        }),
      },
    });

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'edge',
      input: {},
      strict: true,
    })).rejects.toThrow('Tool "edge.checked" args $.ticketId: Required property is missing');

    expect(handled).toBe(false);

    const audit = await readAuditLog(projectDir);
    expect(audit.find((entry) => entry.action === 'tool.schema.blocked')).toMatchObject({
      policy: 'tool-schema',
      toolName: 'edge.checked',
      outcome: 'blocked',
    });
  });
});

async function mkRunProjectDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'fdekit-runtime-agent-'));
}

function createSupportTriageDeployment(extraPolicies = []): DeploymentDefinition {
  const tools = createSupportTriageTools();

  return defineDeployment({
    name: 'test-support-triage',
    environment: 'local',
    providers: {
      mock: {
        name: 'mock',
        model: 'support-triage-local',
        options: {
          planner: supportTriageTestPlanner,
        },
      },
    },
    agents: {
      supportTriage: defineAgent({
        provider: 'mock',
        instructions: 'Triage support tickets and escalate risky customer cases',
        tools,
        policies: [
          limitToolUse({ maxCalls: 8 }),
          ...extraPolicies,
        ],
      }),
    },
    policies: [denyPIILeak()],
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
      apiKey: 'sk-zyxwvutsrqponmlkjihgfedcba',
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
      plan: 'enterprise',
    },
    cus_globex: {
      id: 'cus_globex',
      name: 'Globex',
      tier: 'growth',
      plan: 'team',
    },
  };

  return [
    defineTool<{ ticketId: string }>({
      name: 'ticket.get',
      scopes: ['ticket:read'],
      category: 'context',
      tags: ['ticket', 'read'],
      handler(args) {
        return tickets[args.ticketId] ?? null;
      },
    }),
    defineTool<{ customerId: string }>({
      name: 'customer.get',
      scopes: ['customer:read'],
      category: 'context',
      tags: ['customer', 'read'],
      handler(args) {
        return customers[args.customerId] ?? null;
      },
    }),
    defineTool({
      name: 'issue.create',
      scopes: ['issues:write'],
      category: 'issue',
      tags: ['action', 'escalation', 'issue'],
      handler(args) {
        return { id: 'iss_123', ...args };
      },
    }),
    defineTool({
      name: 'slack.message',
      scopes: ['slack:write'],
      category: 'messaging',
      tags: ['action', 'escalation', 'message'],
      handler(args) {
        return { ok: true, ts: '1710000000.000001', ...args };
      },
    }),
    defineTool<{ ticketId: string; reason: string }>({
      name: 'ticket.escalate',
      scopes: ['ticket:write'],
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
