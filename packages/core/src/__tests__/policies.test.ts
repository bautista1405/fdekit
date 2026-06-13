import { describe, expect, it } from 'vitest';
import {
  defineGovernance,
  denyPIILeak,
  limitToolScopes,
  limitCost,
  limitToolUse,
  redactSecrets,
  requireApproval,
  restrictEnvironments,
  restrictTables,
  type PolicyDecision,
} from '../index.js';

function decision(value: unknown): PolicyDecision {
  expect(value).toBeTypeOf('object');
  return value as PolicyDecision;
}

describe('policy helpers', () => {
  it('defines first-class governance settings for deployments', () => {
    const governance = defineGovernance({
      audit: {
        enabled: true,
        retentionDays: 30,
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
      permissions: {
        requireScopes: true,
        scopes: [
          {
            name: 'issues:write',
            risk: 'high',
          },
        ],
        grants: [
          {
            agent: 'supportTriage',
            scopes: ['issues:write'],
          },
        ],
      },
      dataProtection: {
        denyPII: true,
        redactSecrets: true,
      },
    });

    expect(governance.audit?.retentionDays).toBe(30);
    expect(governance.permissions?.grants?.[0].scopes).toEqual(['issues:write']);
    expect(governance.dataProtection?.denyPII).toBe(true);
  });

  it('requires approval for selected tools only', async () => {
    const policy = requireApproval({ tools: ['issue.create'] });

    expect(await policy.beforeToolCall?.('ticket.get', {}, {})).toEqual({
      allowed: true,
      metadata: undefined,
    });

    const blocked = decision(await policy.beforeToolCall?.('issue.create', {}, {}));
    expect(blocked.allowed).toBe(false);
    expect(blocked.approvalRequired).toBe(true);
  });

  it('limits tool calls by count', async () => {
    const policy = limitToolUse({ maxCalls: 2 });

    expect(decision(await policy.beforeToolCall?.('ticket.get', {}, { toolCallCount: 1 })).allowed).toBe(true);

    const blocked = decision(await policy.beforeToolCall?.('ticket.get', {}, { toolCallCount: 2 }));
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('Tool call limit exceeded');
  });

  it('limits accumulated cost', async () => {
    const policy = limitCost({ maxUsd: 0.25 });

    expect(decision(await policy.beforeToolCall?.('ticket.get', {}, { costUsd: 0.1 })).allowed).toBe(true);

    const blocked = decision(await policy.beforeToolCall?.('ticket.get', {}, { costUsd: 0.25 }));
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('Cost limit exceeded');
    expect(policy.metadata).toMatchObject({
      kind: 'budget',
      maxUsd: 0.25,
    });
  });

  it('limits tool calls by declared permission scopes', async () => {
    const policy = limitToolScopes({
      allowed: ['customer:read', 'issues:write'],
      requireScopes: true,
    });

    expect(decision(await policy.beforeToolCall?.('customer.get', {}, {
      toolScopes: ['customer:read'],
    })).allowed).toBe(true);

    const missing = decision(await policy.beforeToolCall?.('slack.message', {}, {
      toolScopes: ['slack:write'],
    }));
    expect(missing.allowed).toBe(false);
    expect(missing.reason).toContain('ungranted scope');

    const unscoped = decision(await policy.beforeToolCall?.('legacy.tool', {}, {
      toolScopes: [],
    }));
    expect(unscoped.allowed).toBe(false);
    expect(unscoped.reason).toContain('does not declare permission scopes');
  });

  it('restricts selected tools by deployment environment', async () => {
    const policy = restrictEnvironments({
      allowed: ['local', 'staging'],
      tools: ['issue.create'],
    });

    expect(decision(await policy.beforeToolCall?.('issue.create', {}, {
      environment: 'staging',
    })).allowed).toBe(true);
    expect(decision(await policy.beforeToolCall?.('customer.get', {}, {
      environment: 'production',
    })).allowed).toBe(true);

    const blocked = decision(await policy.beforeToolCall?.('issue.create', {}, {
      environment: 'production',
    }));
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('current environment: production');
  });

  it('detects PII-like values before and after tool calls', async () => {
    const policy = denyPIILeak();

    const blockedInput = decision(await policy.beforeToolCall?.('slack.message', {
      text: 'Email alice@example.com about the renewal',
    }, {}));
    expect(blockedInput.allowed).toBe(false);

    const blockedOutput = decision(await policy.afterToolCall?.('customer.get', {
      ssn: '123-45-6789',
    }, {}));
    expect(blockedOutput.allowed).toBe(false);
  });

  it('marks secret-like values for redaction metadata', async () => {
    const policy = redactSecrets();
    const result = decision(await policy.beforeToolCall?.('external.call', {
      token: 'supersecret123',
    }, {}));

    expect(result.allowed).toBe(true);
    expect(result.metadata?.changed).toBe(true);
    expect(result.metadata?.redacted).toContain('[REDACTED]');
    expect(result.metadata?.redacted).not.toContain('supersecret123');
  });

  it('restricts table access from explicit table names and SQL text', async () => {
    const policy = restrictTables({ allowed: ['customers', 'tickets'] });

    expect(decision(await policy.beforeToolCall?.('postgres.query', {
      query: 'select * from customers join tickets on tickets.customer_id = customers.id',
    }, {})).allowed).toBe(true);

    const blocked = decision(await policy.beforeToolCall?.('postgres.query', {
      query: 'select * from invoices',
    }, {}));
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('invoices');
  });
});
