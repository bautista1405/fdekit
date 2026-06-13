import { describe, expect, it } from 'vitest';
import { jiraConnector } from '../index.js';

describe('jiraConnector', () => {
  it('creates deterministic local Jira issues', async () => {
    const connector = jiraConnector({ projectKey: 'SUP' });
    const tool = connector.tools?.find((candidate) => candidate.name === 'jira.issue.create');
    const genericTool = connector.tools?.find((candidate) => candidate.name === 'issue.create');

    await expect(tool?.handler({
      title: 'Escalate company billing outage',
      body: 'Customer cannot access billing',
      ticketId: 'tick_1001',
    }, {})).resolves.toEqual({
      id: 'local_jira_1',
      key: 'SUP-1',
      url: 'https://jira.local/browse/SUP-1',
      mode: 'local',
      projectKey: 'SUP',
      ticketId: 'tick_1001',
    });

    await expect(genericTool?.handler({
      title: 'Generic company billing issue',
      body: 'Customer cannot access billing',
    }, {})).resolves.toMatchObject({
      id: 'local_jira_2',
      key: 'SUP-2',
      mode: 'local',
      projectKey: 'SUP',
    });
  });

  it('creates Jira issues through REST API mode', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = jiraConnector({
      mode: 'api',
      baseUrl: 'https://company.atlassian.net/',
      emailEnv: 'TEST_JIRA_EMAIL',
      apiTokenEnv: 'TEST_JIRA_TOKEN',
      projectKeyEnv: 'TEST_JIRA_PROJECT',
      env: {
        TEST_JIRA_EMAIL: 'fde@example.com',
        TEST_JIRA_TOKEN: 'jira-token',
        TEST_JIRA_PROJECT: 'SUP',
      },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({
          id: '10001',
          key: 'SUP-42',
          self: 'https://company.atlassian.net/rest/api/3/issue/10001',
        }, { status: 201 });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'jira.issue.create');

    await expect(tool?.handler({
      title: 'Escalate company billing outage',
      body: 'Customer cannot access billing',
      priority: 'High',
      labels: ['support-escalation'],
    }, {})).resolves.toMatchObject({
      id: '10001',
      key: 'SUP-42',
      url: 'https://company.atlassian.net/browse/SUP-42',
      mode: 'api',
      projectKey: 'SUP',
    });
    expect(calls[0].input).toBe('https://company.atlassian.net/rest/api/3/issue');
    expect(calls[0].init?.headers).toMatchObject({
      accept: 'application/json',
      authorization: `Basic ${btoa('fde@example.com:jira-token')}`,
      'content-type': 'application/json',
    });
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.fields).toMatchObject({
      project: { key: 'SUP' },
      issuetype: { name: 'Task' },
      summary: 'Escalate company billing outage',
      labels: ['support-escalation'],
      priority: { name: 'High' },
    });
    expect(body.fields.description).toMatchObject({
      type: 'doc',
      version: 1,
    });
  });

  it('requires Jira credentials and project settings in API mode', async () => {
    const connector = jiraConnector({
      mode: 'api',
      env: {},
      fetch: async () => Response.json({ id: '10001', key: 'SUP-1' }),
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'jira.issue.create');

    await expect(tool?.handler({
      title: 'Escalate company billing outage',
      body: 'Customer cannot access billing',
    }, {})).rejects.toThrow('Missing Jira project key');

    const missingBaseUrl = jiraConnector({
      mode: 'api',
      env: { JIRA_PROJECT_KEY: 'SUP' },
      fetch: async () => Response.json({ id: '10001', key: 'SUP-1' }),
    }).tools?.find((candidate) => candidate.name === 'jira.issue.create');

    await expect(missingBaseUrl?.handler({
      title: 'Escalate company billing outage',
      body: 'Customer cannot access billing',
    }, {})).rejects.toThrow('Missing Jira base URL');

    const missingEmail = jiraConnector({
      mode: 'api',
      baseUrl: 'https://company.atlassian.net',
      env: { JIRA_PROJECT_KEY: 'SUP' },
      fetch: async () => Response.json({ id: '10001', key: 'SUP-1' }),
    }).tools?.find((candidate) => candidate.name === 'jira.issue.create');

    await expect(missingEmail?.handler({
      title: 'Escalate company billing outage',
      body: 'Customer cannot access billing',
    }, {})).rejects.toThrow('Missing Jira email');

    const missingToken = jiraConnector({
      mode: 'api',
      baseUrl: 'https://company.atlassian.net',
      env: {
        JIRA_EMAIL: 'fde@example.com',
        JIRA_PROJECT_KEY: 'SUP',
      },
      fetch: async () => Response.json({ id: '10001', key: 'SUP-1' }),
    }).tools?.find((candidate) => candidate.name === 'jira.issue.create');

    await expect(missingToken?.handler({
      title: 'Escalate company billing outage',
      body: 'Customer cannot access billing',
    }, {})).rejects.toThrow('Missing Jira API token');
  });
});
