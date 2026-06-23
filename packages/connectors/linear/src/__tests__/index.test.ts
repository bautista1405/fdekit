import { describe, expect, it } from 'vitest';
import { linearConnector } from '../index.js';

describe('linearConnector', () => {
  it('declares allowed environments on every tool', () => {
    const connector = linearConnector();

    for (const tool of connector.tools ?? []) {
      expect(tool.environments).toEqual(['local', 'development', 'staging']);
    }
  });

  it('creates deterministic local Linear issues', async () => {
    const connector = linearConnector({ teamId: 'team_123' });
    const tool = connector.tools?.find((candidate) => candidate.name === 'linear.issue.create');
    const genericTool = connector.tools?.find((candidate) => candidate.name === 'issue.create');

    await expect(tool?.handler({
      title: 'Escalate company billing outage',
      body: 'Customer cannot access billing',
      ticketId: 'tick_1001',
    }, {})).resolves.toEqual({
      id: 'local_linear_1',
      identifier: 'FDE-1',
      title: 'Escalate company billing outage',
      url: 'https://linear.local/FDE-1',
      mode: 'local',
      teamId: 'team_123',
      ticketId: 'tick_1001',
    });

    await expect(genericTool?.handler({
      title: 'Generic company billing issue',
      body: 'Customer cannot access billing',
    }, {})).resolves.toMatchObject({
      id: 'local_linear_2',
      identifier: 'FDE-2',
      title: 'Generic company billing issue',
      mode: 'local',
      teamId: 'team_123',
    });
  });

  it('creates Linear issues through GraphQL API mode', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = linearConnector({
      mode: 'api',
      apiBaseUrl: 'https://linear.test/graphql/',
      tokenEnv: 'TEST_LINEAR_KEY',
      teamIdEnv: 'TEST_LINEAR_TEAM',
      env: {
        TEST_LINEAR_KEY: 'lin-test',
        TEST_LINEAR_TEAM: 'team_123',
      },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({
          data: {
            issueCreate: {
              success: true,
              issue: {
                id: 'issue_123',
                identifier: 'SUP-42',
                title: 'Escalate company billing outage',
                url: 'https://linear.app/company/issue/SUP-42',
              },
            },
          },
        });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'linear.issue.create');

    await expect(tool?.handler({
      title: 'Escalate company billing outage',
      description: 'Customer cannot access billing',
      priority: 1,
    }, {})).resolves.toMatchObject({
      id: 'issue_123',
      identifier: 'SUP-42',
      title: 'Escalate company billing outage',
      mode: 'api',
      teamId: 'team_123',
    });
    expect(calls[0].input).toBe('https://linear.test/graphql');
    expect(calls[0].init?.headers).toMatchObject({
      authorization: 'lin-test',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      variables: {
        input: {
          title: 'Escalate company billing outage',
          description: 'Customer cannot access billing',
          priority: 1,
          teamId: 'team_123',
        },
      },
    });
  });

  it('maps common issue.create priority labels to Linear priority numbers', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = linearConnector({
      mode: 'api',
      apiBaseUrl: 'https://linear.test/graphql/',
      env: {
        LINEAR_API_KEY: 'lin-test',
        LINEAR_TEAM_ID: 'team_123',
      },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({
          data: {
            issueCreate: {
              success: true,
              issue: {
                id: 'issue_124',
                identifier: 'SUP-43',
                title: 'Generic priority handoff',
                url: 'https://linear.app/company/issue/SUP-43',
              },
            },
          },
        });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'issue.create');

    await expect(tool?.handler({
      title: 'Generic priority handoff',
      body: 'Common issue.create payload',
      priority: 'normal',
    }, {})).resolves.toMatchObject({
      id: 'issue_124',
      identifier: 'SUP-43',
      mode: 'api',
      teamId: 'team_123',
    });

    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      variables: {
        input: {
          title: 'Generic priority handoff',
          description: 'Common issue.create payload',
          priority: 3,
          teamId: 'team_123',
        },
      },
    });
  });

  it('requires Linear API key and team id in API mode', async () => {
    const missingTeam = linearConnector({
      mode: 'api',
      env: { LINEAR_API_KEY: 'lin-test' },
      fetch: async () => Response.json({ data: { issueCreate: { success: true } } }),
    }).tools?.find((candidate) => candidate.name === 'linear.issue.create');

    await expect(missingTeam?.handler({
      title: 'Escalate company billing outage',
    }, {})).rejects.toThrow('Missing Linear team id');

    const missingToken = linearConnector({
      mode: 'api',
      teamId: 'team_123',
      env: {},
      fetch: async () => Response.json({ data: { issueCreate: { success: true } } }),
    }).tools?.find((candidate) => candidate.name === 'linear.issue.create');

    await expect(missingToken?.handler({
      title: 'Escalate company billing outage',
    }, {})).rejects.toThrow('Missing Linear API key');
  });
});
