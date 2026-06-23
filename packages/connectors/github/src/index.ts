import { createHttpReq, defineConnector, defineTool, type ConnectorDefinition } from '@fdekit/core';
import { asRecord, createGitHubIssue, getNumber, getString, normalizeBaseUrl, readEnvValue, requireToken } from './helpers/index.js';
import type { CreateIssueArgs, CreateIssueResult, GitHubConnectorConfig, GitHubConnectorMode, GitHubConnectorOptions } from './interfaces/index.js';
export type { CreateIssueArgs, CreateIssueResult, GitHubConnectorConfig, GitHubConnectorMode, GitHubConnectorOptions } from './interfaces/index.js';

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
    description: 'Create engineering issues; local mode returns deterministic mock GitHub issues; API mode calls the GitHub REST API',
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
    ],
  });
}
