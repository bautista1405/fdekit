import { describe, expect, it } from 'vitest';
import { extractTicketRefs } from '../helpers/index.js';
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

  it('defaults the API repository from GITHUB_REPOSITORY', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = githubConnector({
      mode: 'api',
      apiBaseUrl: 'https://github.test/api/',
      env: {
        GITHUB_TOKEN: 'ghp_test',
        GITHUB_REPOSITORY: 'acme/live-repo',
      },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({
          id: 43,
          number: 8,
          title: 'Live repo issue',
          html_url: 'https://github.com/acme/live-repo/issues/8',
        });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'issue.create');

    expect(connector.config.repository).toBe('acme/live-repo');
    await expect(tool?.handler({
      title: 'Live repo issue',
      body: 'Body',
    }, {})).resolves.toMatchObject({
      repository: 'acme/live-repo',
      url: 'https://github.com/acme/live-repo/issues/8',
    });

    expect(calls[0].input).toBe('https://github.test/api/repos/acme/live-repo/issues');
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

  it('lists pull requests deterministically in local mode', async () => {
    const connector = githubConnector({ repository: 'company/app' });
    const tool = connector.tools?.find((candidate) => candidate.name === 'github.pr.list');

    const result = await tool?.handler({}, {}) as {
      pullRequests: Array<{ number: number; draft: boolean }>;
      state: string;
    };

    expect(result).toMatchObject({ mode: 'local', repository: 'company/app', state: 'open', truncated: false });
    expect(result.pullRequests).toHaveLength(2);
    expect(result.pullRequests[0]).toMatchObject({ number: 482, draft: false });
    expect(result.pullRequests[1]).toMatchObject({ number: 479, draft: true });
  });

  it('lists pull requests in API mode, newest first and capped', async () => {
    const calls: string[] = [];
    const connector = githubConnector({
      mode: 'api',
      repository: 'company/app',
      apiBaseUrl: 'https://github.test/api/',
      env: { GITHUB_TOKEN: 'ghp_test' },
      fetch: async (input) => {
        calls.push(String(input));

        return Response.json([
          {
            number: 12,
            title: 'Second',
            user: { login: 'octocat' },
            base: { ref: 'main' },
            head: { ref: 'feat/b' },
            draft: false,
            updated_at: '2026-08-04T10:00:00Z',
            html_url: 'https://github.com/company/app/pull/12',
          },
          {
            number: 11,
            title: 'First',
            user: { login: 'hubot' },
            base: { ref: 'main' },
            head: { ref: 'feat/a' },
            draft: true,
            updated_at: '2026-08-03T10:00:00Z',
            html_url: 'https://github.com/company/app/pull/11',
          },
        ]);
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'github.pr.list');

    const result = await tool?.handler({ maxResults: 1 }, {}) as { pullRequests: Array<{ number: number }> };

    expect(result).toMatchObject({ mode: 'api', truncated: true });
    expect(result.pullRequests).toEqual([
      expect.objectContaining({ number: 12, title: 'Second', author: 'octocat', draft: false }),
    ]);
    expect(calls[0]).toContain('/repos/company/app/pulls?');
    expect(calls[0]).toContain('state=open');
    expect(calls[0]).toContain('sort=updated');
  });

  it('caps pr.list per_page at the GitHub maximum', async () => {
    const calls: string[] = [];
    const connector = githubConnector({
      mode: 'api',
      repository: 'company/app',
      apiBaseUrl: 'https://github.test/api/',
      env: { GITHUB_TOKEN: 'ghp_test' },
      fetch: async (input) => {
        calls.push(String(input));
        return Response.json([]);
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'github.pr.list');

    await tool?.handler({ maxResults: 5000 }, {});

    expect(calls[0]).toContain('per_page=100');
  });

  it('exposes pr.list as read-only so the inbox cannot post', async () => {
    const connector = githubConnector({ repository: 'company/app' });
    const tool = connector.tools?.find((candidate) => candidate.name === 'github.pr.list');

    expect(tool?.scopes).toEqual(['pulls:read']);
    expect(tool?.scopes).not.toContain('review:write');
  });

  it('returns a deterministic local pull request diff with extracted ticket references', async () => {
    const connector = githubConnector({ repository: 'company/app' });
    const tool = connector.tools?.find((candidate) => candidate.name === 'github.pr.diff');

    const result = await tool?.handler({ number: 7 }, {}) as {
      ticketRefs: Array<{ kind: string; ref: string }>;
    };

    expect(result).toMatchObject({
      mode: 'local',
      repository: 'company/app',
      number: 7,
      baseRef: 'main',
      truncated: false,
      files: [expect.objectContaining({ filePath: 'src/billing.ts', status: 'modified' })],
      url: 'https://github.local/company/app/pull/7',
    });
    expect(result.ticketRefs).toEqual(expect.arrayContaining([
      { kind: 'issue-key', ref: 'ENG-123' },
      { kind: 'github-issue', ref: '42' },
    ]));
  });

  it('fetches pull request metadata and files in API mode', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = githubConnector({
      mode: 'api',
      repository: 'company/app',
      apiBaseUrl: 'https://github.test/api/',
      env: { GITHUB_TOKEN: 'ghp_test' },
      fetch: async (input, init) => {
        calls.push({ input, init });
        const url = String(input);

        if (url.includes('/files')) {
          return Response.json([
            { filename: 'src/billing.ts', status: 'modified', additions: 3, deletions: 1, patch: '@@ -1 +1,3 @@' },
            { filename: 'src/app.ts', status: 'modified', additions: 1, deletions: 0, patch: '@@ -5 +5 @@' },
          ]);
        }

        return Response.json({
          title: 'Retry billing sync',
          body: 'Fixes ENG-9.',
          user: { login: 'octocat' },
          base: { ref: 'main' },
          head: { ref: 'feature/retries' },
          additions: 4,
          deletions: 1,
          html_url: 'https://github.com/company/app/pull/7',
        });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'github.pr.diff');

    await expect(tool?.handler({ number: 7, maxFiles: 1 }, {})).resolves.toMatchObject({
      mode: 'api',
      title: 'Retry billing sync',
      author: 'octocat',
      baseRef: 'main',
      headRef: 'feature/retries',
      additions: 4,
      files: [expect.objectContaining({ filePath: 'src/billing.ts' })],
      truncated: true,
      ticketRefs: expect.arrayContaining([{ kind: 'issue-key', ref: 'ENG-9' }]),
      url: 'https://github.com/company/app/pull/7',
    });

    const urls = calls.map((call) => String(call.input)).sort();
    expect(urls).toEqual([
      'https://github.test/api/repos/company/app/pulls/7',
      'https://github.test/api/repos/company/app/pulls/7/files?per_page=100',
    ]);
    expect(calls[0].init?.headers).toMatchObject({ authorization: 'Bearer ghp_test' });
  });

  it('never approves: review.post rejects approve structurally and maps recommendations to events', async () => {
    const connector = githubConnector({ repository: 'company/app' });
    const tool = connector.tools?.find((candidate) => candidate.name === 'github.review.post');
    const argsSchema = tool?.argsSchema as { properties?: { recommendation?: { enum?: string[] } } };

    expect(argsSchema.properties?.recommendation?.enum).toEqual(['comment', 'request-changes']);

    await expect(tool?.handler({
      number: 7,
      summary: 'Two findings, recommend changes',
      recommendation: 'request-changes',
      comments: [{ path: 'src/billing.ts', line: 2, body: 'Missing retry cap' }],
    }, {})).resolves.toMatchObject({
      event: 'REQUEST_CHANGES',
      commentCount: 1,
      url: 'https://github.local/company/app/pull/7#review',
    });

    await expect(tool?.handler({
      number: 7,
      summary: 'lgtm',
      recommendation: 'approve',
    } as never, {})).rejects.toThrow('humans approve');
  });

  it('posts reviews to the GitHub REST API with RIGHT-side inline comments', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = githubConnector({
      mode: 'api',
      repository: 'company/app',
      apiBaseUrl: 'https://github.test/api/',
      env: { GITHUB_TOKEN: 'ghp_test' },
      fetch: async (input, init) => {
        calls.push({ input, init });

        return Response.json({ id: 1, html_url: 'https://github.com/company/app/pull/7#pullrequestreview-1' });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'github.review.post');

    await expect(tool?.handler({
      number: 7,
      summary: 'One finding',
      recommendation: 'comment',
      comments: [{ path: 'src/billing.ts', line: 2, body: 'Consider a retry cap' }],
    }, {})).resolves.toMatchObject({
      event: 'COMMENT',
      url: 'https://github.com/company/app/pull/7#pullrequestreview-1',
    });

    expect(String(calls[0].input)).toBe('https://github.test/api/repos/company/app/pulls/7/reviews');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      event: 'COMMENT',
      body: 'One finding',
      comments: [{ path: 'src/billing.ts', line: 2, side: 'RIGHT', body: 'Consider a retry cap' }],
    });
  });

  it('replies to review comment threads locally and through the REST API', async () => {
    const local = githubConnector({ repository: 'company/app' });
    const localTool = local.tools?.find((candidate) => candidate.name === 'github.pr.reply');

    await expect(localTool?.handler({ number: 7, commentId: 99, body: 'Fixed in the next push' }, {})).resolves.toMatchObject({
      mode: 'local',
      commentId: 99,
      url: 'https://github.local/company/app/pull/7#discussion-r99',
    });

    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const api = githubConnector({
      mode: 'api',
      repository: 'company/app',
      apiBaseUrl: 'https://github.test/api/',
      env: { GITHUB_TOKEN: 'ghp_test' },
      fetch: async (input, init) => {
        calls.push({ input, init });

        return Response.json({ id: 2, html_url: 'https://github.com/company/app/pull/7#discussion_r100' });
      },
    });
    const apiTool = api.tools?.find((candidate) => candidate.name === 'github.pr.reply');

    await expect(apiTool?.handler({ number: 7, commentId: 99, body: 'Fixed' }, {})).resolves.toMatchObject({
      url: 'https://github.com/company/app/pull/7#discussion_r100',
    });
    expect(String(calls[0].input)).toBe('https://github.test/api/repos/company/app/pulls/7/comments/99/replies');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ body: 'Fixed' });
  });

  it('extracts issue keys, github refs, and urls from PR text', () => {
    expect(extractTicketRefs('Implements ENG-123 and KAN-7 (see #42, https://linear.app/team/issue/ENG-123).')).toEqual(
      expect.arrayContaining([
        { kind: 'issue-key', ref: 'ENG-123' },
        { kind: 'issue-key', ref: 'KAN-7' },
        { kind: 'github-issue', ref: '42' },
        { kind: 'url', ref: 'https://linear.app/team/issue/ENG-123' },
      ]),
    );
    expect(extractTicketRefs('no refs here')).toEqual([]);
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
