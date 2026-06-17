import { describe, expect, it } from 'vitest';
import { githubConnector } from '../index.js';

describe('githubConnector', () => {
  it('declares allowed environments on every tool', () => {
    const connector = githubConnector();

    for (const tool of connector.tools ?? []) {
      expect(tool.environments).toEqual(['local', 'development', 'staging']);
    }
  });

  it('returns a local issue.create tool with deterministic issue numbers', async () => {
    const connector = githubConnector({ repository: 'company/app' });
    const tool = connector.tools?.find((candidate) => candidate.name === 'issue.create');

    expect(await tool?.handler({
      ticketId: 'tick_1001',
      title: '[HIGH] Billing issue',
      body: 'Customer: company Bank',
      priority: 'high',
    }, {})).toMatchObject({
      id: 'local_issue_1',
      number: 1,
      repository: 'company/app',
      labels: ['priority:high'],
      url: 'https://github.local/company/app/issues/1',
    });

    expect(await tool?.handler({
      title: 'Second issue',
      body: 'Body',
    }, {})).toMatchObject({
      id: 'local_issue_2',
      number: 2,
    });
  });

  it('posts issue.create to GitHub REST API in API mode', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = githubConnector({
      mode: 'api',
      repository: 'company/app',
      apiBaseUrl: 'https://github.test/api/',
      env: { GITHUB_TOKEN: 'ghp_test' },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({
          id: 42,
          number: 7,
          title: '[HIGH] Billing issue',
          html_url: 'https://github.com/company/app/issues/7',
        });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'issue.create');

    await expect(tool?.handler({
      ticketId: 'tick_1001',
      title: '[HIGH] Billing issue',
      body: 'Customer: company Bank',
      priority: 'high',
    }, {})).resolves.toMatchObject({
      id: '42',
      number: 7,
      mode: 'api',
      repository: 'company/app',
      labels: ['priority:high'],
      url: 'https://github.com/company/app/issues/7',
    });

    expect(calls[0].input).toBe('https://github.test/api/repos/company/app/issues');
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.headers).toMatchObject({
      accept: 'application/vnd.github+json',
      authorization: 'Bearer ghp_test',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      title: '[HIGH] Billing issue',
      body: 'Customer: company Bank',
      labels: ['priority:high'],
    });
  });

  it('requires a GitHub token in API mode', async () => {
    const connector = githubConnector({
      mode: 'api',
      repository: 'company/app',
      env: {},
      fetch: async () => Response.json({ id: 1, number: 1 }),
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'issue.create');

    await expect(tool?.handler({
      title: 'Issue',
      body: 'Body',
    }, {})).rejects.toThrow('Missing GitHub token');
  });

  it('retries retryable GitHub REST responses and opens the circuit after repeated failures', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = githubConnector({
      mode: 'api',
      repository: 'company/app',
      env: { GITHUB_TOKEN: 'ghp_test' },
      resilience: {
        retry: {
          maxAttempts: 2,
          initialDelayMs: 0,
        },
        circuitBreaker: {
          failureThreshold: 2,
          resetTimeoutMs: 60_000,
        },
        sleep: async () => {},
        now: () => 1_000,
      },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({ message: 'temporary outage' }, { status: 503 });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'issue.create');

    await expect(tool?.handler({
      title: 'Issue 1',
      body: 'Body',
    }, {})).rejects.toThrow('GitHub issue creation failed: temporary outage');
    await expect(tool?.handler({
      title: 'Issue 2',
      body: 'Body',
    }, {})).rejects.toThrow('GitHub issue creation failed: temporary outage');
    await expect(tool?.handler({
      title: 'Issue 3',
      body: 'Body',
    }, {})).rejects.toThrow('Circuit breaker is open');
    expect(calls).toHaveLength(4);
  });
});
