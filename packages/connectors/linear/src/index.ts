import { createHttpReq, defineConnector, defineTool, type ConnectorDefinition } from '@fdekit/core';
import { asRecord, createLinearComment, createLinearIssue, getLinearIssue, getString, normalizeBaseUrl, readEnvValue, requireToken } from './helpers/index.js';
import type { CreateLinearIssueArgs, CreateLinearIssueResult, LinearConnectorConfig, LinearConnectorMode, LinearConnectorOptions, LinearIssueCommentArgs, LinearIssueCommentResult, LinearIssueGetArgs, LinearIssueGetResult } from './interfaces/index.js';
export type { CreateLinearIssueArgs, CreateLinearIssueResult, LinearConnectorConfig, LinearConnectorMode, LinearConnectorOptions, LinearIssueCommentArgs, LinearIssueCommentResult, LinearIssueGetArgs, LinearIssueGetResult } from './interfaces/index.js';

const defaultToolEnvironments = ['local', 'development', 'staging'];
const linearPriorityAliases: Record<string, number> = {
  none: 0,
  'no priority': 0,
  urgent: 1,
  critical: 1,
  high: 2,
  normal: 3,
  medium: 3,
  low: 4,
};

const issueGetArgsSchema = {
  type: 'object',
  required: ['key'],
  properties: {
    key: {
      type: 'string',
      description: 'Linear issue identifier, for example ENG-123',
    },
  },
};

const issueCommentArgsSchema = {
  type: 'object',
  required: ['key', 'body'],
  properties: {
    key: {
      type: 'string',
      description: 'Linear issue identifier, for example ENG-123',
    },
    body: {
      type: 'string',
      description: 'Comment body, for example a review status summary',
    },
  },
};

const createLinearIssueArgsSchema = {
  type: 'object',
  required: ['title'],
  properties: {
    title: {
      type: 'string',
      description: 'Short issue title',
    },
    description: {
      type: 'string',
      description: 'Linear issue description; use this or body',
    },
    body: {
      type: 'string',
      description: 'Common issue body; use this or description',
    },
    teamId: {
      type: 'string',
      description: 'Optional Linear team id override',
    },
    priority: {
      type: ['number', 'string'],
      minimum: 0,
      maximum: 4,
      description: 'Optional Linear priority number 0-4, or common priority label such as low, normal, high, or urgent',
    },
    labelIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional Linear label ids',
    },
    assigneeId: {
      type: 'string',
      description: 'Optional Linear assignee id',
    },
    ticketId: {
      type: 'string',
      description: 'Optional source ticket id',
    },
  },
};

export function linearConnector(options: LinearConnectorOptions = {}): ConnectorDefinition<LinearConnectorConfig> {
  const mode = options.mode ?? 'local';
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl ?? 'https://api.linear.app/graphql');
  const tokenEnv = options.tokenEnv ?? 'LINEAR_API_KEY';
  const teamIdEnv = options.teamIdEnv ?? 'LINEAR_TEAM_ID';
  const http = createHttpReq(options.resilience);
  const fetchImpl = ((input, init) => http.request(options.fetch ?? globalThis.fetch, input, init)) as typeof globalThis.fetch;
  let localIssueCounter = 0;
  const createIssue = async (args: CreateLinearIssueArgs): Promise<CreateLinearIssueResult> => {
    localIssueCounter += 1;
    const teamId = args.teamId ?? options.teamId ?? readEnvValue(teamIdEnv, options.env);
    const priority = normalizeLinearPriority(args.priority);

    if (mode === 'api') {
      if (!teamId) {
        throw new Error(`Missing Linear team id; set ${teamIdEnv} or pass teamId to linear.issue.create`);
      }

      const response = await createLinearIssue({
        apiBaseUrl,
        token: requireToken(tokenEnv, options.env),
        fetchImpl,
        input: {
          title: args.title,
          description: args.description ?? args.body,
          teamId,
          priority,
          labelIds: args.labelIds,
          assigneeId: args.assigneeId,
        },
      });
      const issue = asRecord(asRecord(asRecord(response).data).issueCreate).issue;
      const record = asRecord(issue);

      return {
        id: getString(record.id) ?? `linear_issue_${localIssueCounter}`,
        identifier: getString(record.identifier),
        title: getString(record.title) ?? args.title,
        url: getString(record.url),
        mode,
        teamId,
        ticketId: args.ticketId,
        response,
      };
    }

    return {
      id: `local_linear_${localIssueCounter}`,
      identifier: `FDE-${localIssueCounter}`,
      title: args.title,
      url: `https://linear.local/FDE-${localIssueCounter}`,
      mode,
      teamId,
      ticketId: args.ticketId,
    };
  };

  return defineConnector({
    name: 'linear',
    description: 'Create and read Linear issues and post comments; local mode returns deterministic fixtures; API mode calls Linear GraphQL',
    config: {
      mode,
      apiBaseUrl,
      tokenEnv,
      teamId: options.teamId,
      teamIdEnv,
    },
    env: mode === 'api'
      ? [
        {
          name: tokenEnv,
          required: true,
          description: 'Linear API key used to create issues',
        },
        {
          name: teamIdEnv,
          required: !options.teamId,
          description: 'Linear team UUID used when the tool call does not pass teamId',
        },
      ]
      : [],
    tools: [
      defineTool<CreateLinearIssueArgs, CreateLinearIssueResult>({
        name: 'linear.issue.create',
        description: 'Create a Linear issue from an agent handoff',
        scopes: ['issues:write'],
        environments: defaultToolEnvironments,
        category: 'issue',
        tags: ['action', 'escalation', 'issue'],
        argsSchema: createLinearIssueArgsSchema,
        handler: createIssue,
      }),
      defineTool<CreateLinearIssueArgs, CreateLinearIssueResult>({
        name: 'issue.create',
        description: 'Create an engineering issue in Linear using the common issue.create capability',
        scopes: ['issues:write'],
        environments: defaultToolEnvironments,
        category: 'issue',
        tags: ['action', 'escalation', 'issue'],
        argsSchema: createLinearIssueArgsSchema,
        handler: createIssue,
      }),
      defineTool<LinearIssueGetArgs, LinearIssueGetResult>({
        name: 'linear.issue.get',
        description: 'Fetch a Linear issue (title, description, state) referenced by a pull request, to check the implementation against its intent',
        scopes: ['issues:read'],
        environments: defaultToolEnvironments,
        category: 'issue',
        tags: ['context', 'issue', 'read', 'review'],
        argsSchema: issueGetArgsSchema,
        async handler(args) {
          const key = typeof args.key === 'string' ? args.key.trim() : '';

          if (!key) {
            throw new Error('linear.issue.get requires a non-empty issue key');
          }

          if (mode === 'api') {
            const response = await getLinearIssue({
              apiBaseUrl,
              token: requireToken(tokenEnv, options.env),
              fetchImpl,
              key,
            });
            const record = asRecord(asRecord(asRecord(response).data).issue);

            if (!getString(record.id)) {
              throw new Error(`Linear issue not found: ${key}`);
            }

            return {
              mode,
              key: getString(record.identifier) ?? key,
              id: getString(record.id),
              title: getString(record.title) ?? '',
              description: getString(record.description) ?? '',
              state: getString(asRecord(record.state).name),
              url: getString(record.url),
              response,
            };
          }

          return {
            mode,
            key,
            id: `local_linear_${key}`,
            title: `Local fixture: ${key}`,
            description: 'Add retry handling with exponential backoff to the billing sync so transient failures do not block renewals.',
            state: 'In Progress',
            url: `https://linear.local/${key}`,
          };
        },
      }),
      defineTool<LinearIssueCommentArgs, LinearIssueCommentResult>({
        name: 'linear.issue.comment',
        description: 'Post a short status comment back to a Linear issue, for example a review summary',
        scopes: ['issues:write'],
        environments: defaultToolEnvironments,
        category: 'issue',
        tags: ['action', 'issue', 'write', 'review'],
        argsSchema: issueCommentArgsSchema,
        async handler(args) {
          const key = typeof args.key === 'string' ? args.key.trim() : '';

          if (!key) {
            throw new Error('linear.issue.comment requires a non-empty issue key');
          }

          if (!args.body?.trim()) {
            throw new Error('linear.issue.comment requires a non-empty body');
          }

          if (mode === 'api') {
            const token = requireToken(tokenEnv, options.env);
            const issueResponse = await getLinearIssue({ apiBaseUrl, token, fetchImpl, key });
            const issueId = getString(asRecord(asRecord(asRecord(issueResponse).data).issue).id);

            if (!issueId) {
              throw new Error(`Linear issue not found: ${key}`);
            }

            const response = await createLinearComment({
              apiBaseUrl,
              token,
              fetchImpl,
              issueId,
              body: args.body,
            });
            const comment = asRecord(asRecord(asRecord(asRecord(response).data).commentCreate).comment);

            return {
              mode,
              key,
              posted: true,
              url: getString(comment.url),
              response,
            };
          }

          return {
            mode,
            key,
            posted: true,
            url: `https://linear.local/${key}#comment-local`,
          };
        },
      }),
    ],
  });
}

function normalizeLinearPriority(priority: number | string | undefined): number | undefined {
  if (typeof priority === 'number') {
    return isLinearPriorityNumber(priority) ? priority : undefined;
  }

  const value = priority?.trim();

  if (!value) {
    return undefined;
  }

  const numeric = Number(value);

  if (isLinearPriorityNumber(numeric)) {
    return numeric;
  }

  return linearPriorityAliases[value.toLowerCase().replace(/[\s_-]+/g, ' ')];
}

function isLinearPriorityNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 4;
}
