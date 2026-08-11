import { createHttpReq, defineConnector, defineTool, type ConnectorDefinition } from '@fdekit/core';
import { asRecord, createGitHubIssue, extractTicketRefs, fetchGitHubPr, fetchGitHubPrFiles, fetchGitHubPrList, getNumber, getString, normalizeBaseUrl, postGitHubReview, postGitHubReviewReply, readEnvValue, requireToken } from './helpers/index.js';
import type { CreateIssueArgs, CreateIssueResult, GitHubConnectorConfig, GitHubConnectorMode, GitHubConnectorOptions, PrDiffArgs, PrDiffResult, PrListArgs, PrListResult, PrReplyArgs, PrReplyResult, ReviewPostArgs, ReviewPostResult } from './interfaces/index.js';
export type { CreateIssueArgs, CreateIssueResult, GitHubConnectorConfig, GitHubConnectorMode, GitHubConnectorOptions, PrDiffArgs, PrDiffFile, PrDiffResult, PrListArgs, PrListItem, PrListResult, PrReplyArgs, PrReplyResult, ReviewComment, ReviewPostArgs, ReviewPostResult, TicketRef } from './interfaces/index.js';

const defaultToolEnvironments = ['local', 'development', 'staging'];

const createIssueArgsSchema = {
  type: 'object',
  required: ['title', 'body'],
  properties: {
    ticketId: {
      type: 'string',
      description: 'Optional source ticket id',
    },
    title: {
      type: 'string',
      description: 'Short issue title',
    },
    body: {
      type: 'string',
      description: 'Issue body with the finding, evidence, and requested follow-up',
    },
    priority: {
      type: 'string',
      description: 'Optional priority label such as low, normal, high, or urgent',
    },
    labels: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional issue labels',
    },
  },
};

const prDiffArgsSchema = {
  type: 'object',
  required: ['number'],
  properties: {
    number: {
      type: 'number',
      description: 'Pull request number',
    },
    maxFiles: {
      type: 'number',
      description: 'Maximum number of changed files to return (default 50)',
    },
  },
};

const prListArgsSchema = {
  type: 'object',
  properties: {
    state: {
      type: 'string',
      enum: ['open', 'closed', 'all'],
      description: 'Which pull requests to list (default open)',
    },
    maxResults: {
      type: 'number',
      description: 'Maximum number of pull requests to return (default 50, max 100)',
    },
  },
};

const reviewPostArgsSchema = {
  type: 'object',
  required: ['number', 'summary', 'recommendation'],
  properties: {
    number: {
      type: 'number',
      description: 'Pull request number',
    },
    summary: {
      type: 'string',
      description: 'Review summary; include the recommendation and finding count',
    },
    recommendation: {
      type: 'string',
      enum: ['comment', 'request-changes'],
      description: 'Review outcome to request; approve is intentionally not available - humans approve pull requests',
    },
    comments: {
      type: 'array',
      description: 'Inline review comments anchored to lines in the new file version',
      items: {
        type: 'object',
        required: ['path', 'line', 'body'],
        properties: {
          path: {
            type: 'string',
            description: 'File path in the pull request',
          },
          line: {
            type: 'number',
            description: '1-based line in the new file version',
          },
          body: {
            type: 'string',
            description: 'Comment body',
          },
        },
      },
    },
  },
};

const prReplyArgsSchema = {
  type: 'object',
  required: ['number', 'commentId', 'body'],
  properties: {
    number: {
      type: 'number',
      description: 'Pull request number',
    },
    commentId: {
      type: 'number',
      description: 'Id of the review comment being replied to',
    },
    body: {
      type: 'string',
      description: 'Reply body',
    },
  },
};

export function githubConnector(options: GitHubConnectorOptions = {}): ConnectorDefinition<GitHubConnectorConfig> {
  const mode = options.mode ?? 'local';
  const tokenEnv = options.tokenEnv ?? 'GITHUB_TOKEN';
  const repositoryEnv = options.repositoryEnv ?? 'GITHUB_REPOSITORY';
  const repository = options.repository ?? readEnvValue(repositoryEnv, options.env) ?? 'company/support-triage';
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl ?? 'https://api.github.com');
  const http = createHttpReq(options.resilience);
  const fetchImpl = ((input, init) => http.request(options.fetch ?? globalThis.fetch, input, init)) as typeof globalThis.fetch;
  let issueNumber = 0;

  return defineConnector({
    name: 'github',
    description: 'Create engineering issues and review pull requests; local mode returns deterministic fixtures; API mode calls the GitHub REST API',
    config: {
      mode,
      repository,
      tokenEnv,
      repositoryEnv,
      apiBaseUrl,
    },
    env: mode === 'api'
      ? [
        {
          name: tokenEnv,
          required: true,
          description: 'GitHub token used to create issues through the REST API',
        },
        {
          name: repositoryEnv,
          required: true,
          description: 'GitHub owner/repo where escalation issues should be created',
        },
      ]
      : [],
    tools: [
      defineTool<CreateIssueArgs, CreateIssueResult>({
        name: 'issue.create',
        description: 'Create an engineering issue from an escalated support case',
        scopes: ['issues:write'],
        environments: defaultToolEnvironments,
        category: 'issue',
        tags: ['action', 'escalation', 'issue'],
        argsSchema: createIssueArgsSchema,
        async handler(args) {
          issueNumber += 1;
          const labels = [
            ...(args.labels ?? []),
            args.priority ? `priority:${args.priority}` : '',
          ].filter(Boolean);

          if (mode === 'api') {
            const response = await createGitHubIssue({
              apiBaseUrl,
              token: requireToken(tokenEnv, options.env),
              fetchImpl,
              repository,
              title: args.title,
              body: args.body,
              labels,
            });
            const record = asRecord(response);

            return {
              id: String(record.id ?? record.node_id ?? `github_issue_${issueNumber}`),
              number: getNumber(record.number) ?? issueNumber,
              mode,
              repository,
              title: getString(record.title) ?? args.title,
              body: args.body,
              priority: args.priority,
              labels,
              ticketId: args.ticketId,
              url: getString(record.html_url) ?? `https://github.com/${repository}/issues/${issueNumber}`,
              response,
            };
          }

          return {
            id: `local_issue_${issueNumber}`,
            number: issueNumber,
            mode,
            repository,
            title: args.title,
            body: args.body,
            priority: args.priority,
            labels,
            ticketId: args.ticketId,
            url: `https://github.local/${repository}/issues/${issueNumber}`,
          };
        },
      }),
      defineTool<PrListArgs, PrListResult>({
        name: 'github.pr.list',
        description: 'List pull requests for the configured repository, most recently updated first',
        scopes: ['pulls:read'],
        environments: defaultToolEnvironments,
        category: 'review',
        tags: ['context', 'review', 'read'],
        argsSchema: prListArgsSchema,
        async handler(args) {
          const state = args.state ?? 'open';
          // Cap defensively: GitHub rejects per_page > 100, and an unbounded
          // inbox query is a cost and latency footgun.
          const cap = Math.min(Math.max(args.maxResults ?? 50, 1), 100);

          if (mode === 'api') {
            const response = await fetchGitHubPrList({
              apiBaseUrl,
              token: requireToken(tokenEnv, options.env),
              fetchImpl,
              repository,
              state,
              perPage: cap,
            });
            const list = Array.isArray(response) ? response : [];
            const pullRequests = list.slice(0, cap).map((item) => {
              const entry = asRecord(item);
              const number = getNumber(entry.number) ?? 0;

              return {
                number,
                title: getString(entry.title) ?? '',
                author: getString(asRecord(entry.user).login) ?? '',
                baseRef: getString(asRecord(entry.base).ref) ?? '',
                headRef: getString(asRecord(entry.head).ref) ?? '',
                draft: entry.draft === true,
                updatedAt: getString(entry.updated_at) ?? '',
                url: getString(entry.html_url) ?? `https://github.com/${repository}/pull/${number}`,
              };
            });

            return { mode, repository, state, pullRequests, truncated: list.length > cap };
          }

          const localPullRequests = [
            {
              number: 482,
              title: 'Make totals quantity-aware',
              author: 'local-dev',
              baseRef: 'main',
              headRef: 'feat/qty-aware-totals',
              draft: false,
              updatedAt: '2026-08-04T18:20:00Z',
              url: `https://github.local/${repository}/pull/482`,
            },
            {
              number: 479,
              title: 'Add retry handling to billing sync',
              author: 'local-dev',
              baseRef: 'main',
              headRef: 'feature/billing-retries-479',
              draft: true,
              updatedAt: '2026-08-03T09:05:00Z',
              url: `https://github.local/${repository}/pull/479`,
            },
          ];

          return {
            mode,
            repository,
            state,
            pullRequests: localPullRequests.slice(0, cap),
            truncated: localPullRequests.length > cap,
          };
        },
      }),
      defineTool<PrDiffArgs, PrDiffResult>({
        name: 'github.pr.diff',
        description: 'Fetch a pull request: metadata, linked ticket references, and changed files with patch hunks',
        scopes: ['pulls:read'],
        environments: defaultToolEnvironments,
        category: 'review',
        tags: ['context', 'review', 'read'],
        argsSchema: prDiffArgsSchema,
        async handler(args) {
          const cap = args.maxFiles ?? 50;

          if (mode === 'api') {
            const token = requireToken(tokenEnv, options.env);
            const [pr, files] = await Promise.all([
              fetchGitHubPr({ apiBaseUrl, token, fetchImpl, repository, number: args.number }),
              fetchGitHubPrFiles({ apiBaseUrl, token, fetchImpl, repository, number: args.number }),
            ]);
            const record = asRecord(pr);
            const fileList = Array.isArray(files) ? files : [];
            const mapped = fileList.slice(0, cap).map((file) => {
              const entry = asRecord(file);

              return {
                filePath: getString(entry.filename) ?? '',
                status: getString(entry.status) ?? 'modified',
                additions: getNumber(entry.additions) ?? 0,
                deletions: getNumber(entry.deletions) ?? 0,
                patch: getString(entry.patch) ?? '',
              };
            });
            const title = getString(record.title) ?? '';
            const body = getString(record.body) ?? '';
            const headRef = getString(asRecord(record.head).ref) ?? '';

            return {
              mode,
              repository,
              number: args.number,
              title,
              body,
              author: getString(asRecord(record.user).login) ?? '',
              baseRef: getString(asRecord(record.base).ref) ?? '',
              headRef,
              additions: getNumber(record.additions) ?? mapped.reduce((sum, file) => sum + file.additions, 0),
              deletions: getNumber(record.deletions) ?? mapped.reduce((sum, file) => sum + file.deletions, 0),
              files: mapped,
              truncated: fileList.length > cap,
              ticketRefs: extractTicketRefs(`${title}\n${body}\n${headRef}`),
              url: getString(record.html_url) ?? `https://github.com/${repository}/pull/${args.number}`,
            };
          }

          const title = `Add retry handling to billing sync (#${args.number})`;
          const body = 'Implements ENG-123: retry transient billing failures before rollout.\n\nCloses #42.';
          const localFiles = [{
            filePath: 'src/billing.ts',
            status: 'modified',
            additions: 2,
            deletions: 1,
            patch: [
              '@@ -1,3 +1,5 @@',
              ' export function syncBilling(): boolean {',
              '-  return true;',
              '+  const retries = 3;',
              '+  return retries > 0;',
              ' }',
            ].join('\n'),
          }];

          return {
            mode,
            repository,
            number: args.number,
            title,
            body,
            author: 'local-dev',
            baseRef: 'main',
            headRef: `feature/billing-retries-${args.number}`,
            additions: 2,
            deletions: 1,
            files: localFiles.slice(0, cap),
            truncated: localFiles.length > cap,
            ticketRefs: extractTicketRefs(`${title}\n${body}`),
            url: `https://github.local/${repository}/pull/${args.number}`,
          };
        },
      }),
      defineTool<ReviewPostArgs, ReviewPostResult>({
        name: 'github.review.post',
        description: 'Post a pull request review: inline comments plus a summary with a recommendation. Approving is intentionally impossible - humans approve pull requests; allowed outcomes are comment and request-changes.',
        scopes: ['review:write'],
        environments: defaultToolEnvironments,
        category: 'review',
        tags: ['action', 'review', 'write'],
        argsSchema: reviewPostArgsSchema,
        async handler(args) {
          // Structural guard, independent of the schema enum: the agent can
          // never approve a pull request (humans approve).
          if ((args.recommendation as string) === 'approve') {
            throw new Error('github.review.post cannot approve pull requests: humans approve; use "comment" or "request-changes"');
          }

          if (args.recommendation !== 'comment' && args.recommendation !== 'request-changes') {
            throw new Error('github.review.post recommendation must be "comment" or "request-changes"');
          }

          const event = args.recommendation === 'request-changes' ? 'REQUEST_CHANGES' as const : 'COMMENT' as const;
          const comments = (args.comments ?? []).map((comment) => ({
            path: comment.path,
            line: comment.line,
            side: 'RIGHT',
            body: comment.body,
          }));

          if (mode === 'api') {
            const response = await postGitHubReview({
              apiBaseUrl,
              token: requireToken(tokenEnv, options.env),
              fetchImpl,
              repository,
              number: args.number,
              event,
              body: args.summary,
              comments,
            });
            const record = asRecord(response);

            return {
              mode,
              repository,
              number: args.number,
              event,
              commentCount: comments.length,
              url: getString(record.html_url) ?? `https://github.com/${repository}/pull/${args.number}`,
              response,
            };
          }

          return {
            mode,
            repository,
            number: args.number,
            event,
            commentCount: comments.length,
            url: `https://github.local/${repository}/pull/${args.number}#review`,
          };
        },
      }),
      defineTool<PrReplyArgs, PrReplyResult>({
        name: 'github.pr.reply',
        description: 'Reply to a review comment thread on a pull request',
        scopes: ['review:write'],
        environments: defaultToolEnvironments,
        category: 'review',
        tags: ['action', 'review', 'write'],
        argsSchema: prReplyArgsSchema,
        async handler(args) {
          if (mode === 'api') {
            const response = await postGitHubReviewReply({
              apiBaseUrl,
              token: requireToken(tokenEnv, options.env),
              fetchImpl,
              repository,
              number: args.number,
              commentId: args.commentId,
              body: args.body,
            });
            const record = asRecord(response);

            return {
              mode,
              repository,
              number: args.number,
              commentId: args.commentId,
              url: getString(record.html_url) ?? `https://github.com/${repository}/pull/${args.number}`,
              response,
            };
          }

          return {
            mode,
            repository,
            number: args.number,
            commentId: args.commentId,
            url: `https://github.local/${repository}/pull/${args.number}#discussion-r${args.commentId}`,
          };
        },
      }),
    ],
  });
}
