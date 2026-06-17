import { describe, expect, it } from 'vitest';
import { environmentEndpoint } from '@fdekit/core';
import { customerApiConnector } from '../index.js';

describe('customerApiConnector', () => {
  it('declares allowed environments on every tool', () => {
    const connector = customerApiConnector();

    for (const tool of connector.tools ?? []) {
      expect(tool.environments).toEqual(['local', 'development', 'staging']);
    }
  });

  it('exposes a live health check tool backed by /health', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = customerApiConnector({
      baseUrl: 'http://customer-api.local/',
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({ ok: true, service: 'customer-api' });
      },
    });
    const healthTool = findTool(connector, 'customerApi.healthCheck');

    await expect(healthTool.handler({}, {})).resolves.toMatchObject({
      ok: true,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe('http://customer-api.local/health');
  });

  it('reports unhealthy 200 responses as failed health checks', async () => {
    const connector = customerApiConnector({
      baseUrl: 'http://customer-api.local',
      fetch: async () => Response.json({ ok: false }),
    });
    const healthTool = findTool(connector, 'customerApi.healthCheck');

    await expect(healthTool.handler({}, {})).resolves.toMatchObject({
      ok: false,
    });
  });

  it('creates customer and ticket tools backed by the configured base URL', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = customerApiConnector({
      baseUrl: 'http://customer-api.local/',
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({ ok: true, url: String(input) });
      },
    });

    const customerTool = connector.tools?.find((tool) => tool.name === 'customer.get');
    const ticketTool = connector.tools?.find((tool) => tool.name === 'ticket.get');

    expect(connector.config?.baseUrl).toBe('http://customer-api.local');
    expect(await customerTool?.handler({ customerId: 'cus_company' }, {})).toEqual({
      ok: true,
      url: 'http://customer-api.local/customers/cus_company',
    });
    expect(await ticketTool?.handler({ ticketId: 'tick_1001' }, {})).toEqual({
      ok: true,
      url: 'http://customer-api.local/tickets/tick_1001',
    });
    expect(calls).toHaveLength(2);
  });

  it('resolves the base URL env override at call time', async () => {
    const urls: string[] = [];
    const env: Record<string, string | undefined> = {};
    const connector = customerApiConnector({
      env,
      fetch: async (input) => {
        urls.push(String(input));
        return Response.json({ ok: true });
      },
    });
    const customerTool = connector.tools?.find((tool) => tool.name === 'customer.get');

    await customerTool?.handler({ customerId: 'cus_1' }, {});
    env.CUSTOMER_API_URL = 'http://customer-api.staging:9000';
    await customerTool?.handler({ customerId: 'cus_1' }, {});

    expect(urls).toEqual([
      'http://127.0.0.1:8787/customers/cus_1',
      'http://customer-api.staging:9000/customers/cus_1',
    ]);
  });

  it('resolves an environment endpoint ref from the tool call context', async () => {
    const urls: string[] = [];
    const connector = customerApiConnector({
      baseUrl: environmentEndpoint('customer-api'),
      fetch: async (input) => {
        urls.push(String(input));
        return Response.json({ ok: true });
      },
    });
    const customerTool = connector.tools?.find((tool) => tool.name === 'customer.get');

    expect(connector.config?.baseUrl).toBe('environment://customer-api');

    await customerTool?.handler({ customerId: 'cus_1' }, {
      runtimeEnvironment: {
        name: 'docker-env',
        kind: 'local-docker',
        evidence: {
          kind: 'local-docker',
          name: 'docker-env',
          endpoints: [
            { name: 'customer-api', url: 'http://127.0.0.1:9787' },
          ],
        },
      },
    });

    expect(urls).toEqual(['http://127.0.0.1:9787/customers/cus_1']);
  });

  it('fails loudly when an environment endpoint ref cannot be resolved', async () => {
    const connector = customerApiConnector({
      baseUrl: environmentEndpoint('customer-api'),
      fetch: async () => Response.json({ ok: true }),
    });
    const customerTool = connector.tools?.find((tool) => tool.name === 'customer.get');

    await expect(customerTool?.handler({ customerId: 'cus_1' }, {})).rejects.toThrow(
      'references environment endpoint "customer-api"',
    );
  });

  it('posts ticket escalations as JSON', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = customerApiConnector({
      baseUrl: 'http://customer-api.local',
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({ status: 'escalated' });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'ticket.escalate');

    await tool?.handler({
      ticketId: 'tick_1001',
      reason: 'renewal risk',
      channel: '#support-escalations',
    }, {});

    expect(calls[0].input).toBe('http://customer-api.local/tickets/tick_1001/escalate');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      reason: 'renewal risk',
      channel: '#support-escalations',
    });
  });

  it('supports custom client API routes and response mappers', async () => {
    interface ClientCustomer {
      account_id: string;
      company_name: string;
      plan_tier: string;
    }

    interface ClientTicket {
      case_id: string;
      account_id: string;
      subject: string;
      description: string;
      severity: string;
      labels: string[];
    }

    interface ClientEscalation {
      escalation_id: string;
      state: string;
    }

    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = customerApiConnector<ClientCustomer, ClientTicket, ClientEscalation>({
      baseUrl: 'https://client.example.com',
      routes: {
        getCustomer: ({ customerId }) => `/v1/accounts/${customerId}`,
        getTicket: ({ ticketId }) => `/v1/cases/${ticketId}?include=account`,
        escalateTicket: ({ ticketId }) => `/v1/cases/${ticketId}/escalations`,
      },
      escalationBody: ({ reason, channel }) => ({ note: reason, notifyChannel: channel }),
      mapCustomer: (raw) => ({
        id: raw.account_id,
        name: raw.company_name,
        tier: raw.plan_tier,
      }),
      mapTicket: (raw) => ({
        id: raw.case_id,
        customerId: raw.account_id,
        title: raw.subject,
        body: raw.description,
        priority: raw.severity,
        tags: raw.labels,
      }),
      mapEscalation: (raw) => ({
        id: raw.escalation_id,
        status: raw.state,
      }),
      fetch: async (input, init) => {
        calls.push({ input, init });

        if (String(input).includes('/v1/accounts/')) {
          return Response.json({
            account_id: 'cus_company',
            company_name: 'company Corp',
            plan_tier: 'enterprise',
          });
        }

        if (String(input).includes('/v1/cases/tick_1001/escalations')) {
          return Response.json({
            escalation_id: 'esc_1',
            state: 'queued',
          }, { status: 201 });
        }

        return Response.json({
          case_id: 'tick_1001',
          account_id: 'cus_company',
          subject: 'Billing outage',
          description: 'Cannot access billing',
          severity: 'high',
          labels: ['billing', 'renewal'],
        });
      },
    });

    const customerTool = connector.tools?.find((tool) => tool.name === 'customer.get');
    const ticketTool = connector.tools?.find((tool) => tool.name === 'ticket.get');
    const escalationTool = connector.tools?.find((tool) => tool.name === 'ticket.escalate');

    expect(connector.config?.customRoutes).toBe(true);
    expect(connector.config?.customMappers).toBe(true);
    expect(await customerTool?.handler({ customerId: 'cus_company' }, {})).toEqual({
      id: 'cus_company',
      name: 'company Corp',
      tier: 'enterprise',
    });
    expect(await ticketTool?.handler({ ticketId: 'tick_1001' }, {})).toEqual({
      id: 'tick_1001',
      customerId: 'cus_company',
      title: 'Billing outage',
      body: 'Cannot access billing',
      priority: 'high',
      tags: ['billing', 'renewal'],
    });
    expect(await escalationTool?.handler({
      ticketId: 'tick_1001',
      reason: 'renewal risk',
      channel: '#support-escalations',
    }, {})).toEqual({
      id: 'esc_1',
      status: 'queued',
    });

    expect(calls.map((call) => call.input)).toEqual([
      'https://client.example.com/v1/accounts/cus_company',
      'https://client.example.com/v1/cases/tick_1001?include=account',
      'https://client.example.com/v1/cases/tick_1001/escalations',
    ]);
    expect(JSON.parse(String(calls[2].init?.body))).toEqual({
      note: 'renewal risk',
      notifyChannel: '#support-escalations',
    });
  });

  it('allows a custom route to return an absolute URL', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = customerApiConnector({
      baseUrl: 'https://client.example.com',
      routes: {
        getCustomer: ({ customerId }) => `https://crm.example.com/accounts/${customerId}`,
      },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({ ok: true });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'customer.get');

    await tool?.handler({ customerId: 'cus_company' }, {});

    expect(calls[0].input).toBe('https://crm.example.com/accounts/cus_company');
  });
});

function findTool(
  connector: ReturnType<typeof customerApiConnector>,
  name: string,
): NonNullable<ReturnType<typeof customerApiConnector>['tools']>[number] {
  const tool = connector.tools?.find((candidate) => candidate.name === name);

  if (!tool) {
    throw new Error(`Missing tool ${name}`);
  }

  return tool;
}
