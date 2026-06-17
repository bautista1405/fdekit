import { createHttpReq, defineConnector, defineTool, type ConnectorDefinition } from '@fdekit/core';
import { asRecord, createLinearIssue, getString, normalizeBaseUrl, readEnvValue, requireToken } from './helpers/index.js';
import type { CreateLinearIssueArgs, CreateLinearIssueResult, LinearConnectorConfig, LinearConnectorMode, LinearConnectorOptions } from './interfaces/index.js';
export type { CreateLinearIssueArgs, CreateLinearIssueResult, LinearConnectorConfig, LinearConnectorMode, LinearConnectorOptions } from './interfaces/index.js';

const defaultToolEnvironments = ['local', 'development', 'staging'];

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
      type: 'number',
      description: 'Optional Linear numeric priority',
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
          priority: args.priority,
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
    description: 'Create Linear issues; local mode returns deterministic issues; API mode calls Linear GraphQL',
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
    ],
  });
}
