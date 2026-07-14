import { createHttpReq, defineConnector, defineTool, type ConnectorDefinition } from '@fdekit/core';
import {
  asRecord,
  createJiraComment,
  createJiraIssue,
  fromAtlassianDocument,
  getJiraIssue,
  getString,
  normalizeBaseUrl,
  readEnvValue,
  requireEnv,
  toAtlassianDocument,
} from './helpers/index.js';
import type { CreateJiraIssueArgs, CreateJiraIssueResult, JiraConnectorConfig, JiraConnectorMode, JiraConnectorOptions, JiraIssueCommentArgs, JiraIssueCommentResult, JiraIssueGetArgs, JiraIssueGetResult } from './interfaces/index.js';
export type { CreateJiraIssueArgs, CreateJiraIssueResult, JiraConnectorConfig, JiraConnectorMode, JiraConnectorOptions, JiraIssueCommentArgs, JiraIssueCommentResult, JiraIssueGetArgs, JiraIssueGetResult } from './interfaces/index.js';

const defaultToolEnvironments = ['local', 'development', 'staging'];
const jiraPriorityAliases: Record<string, string> = {
  critical: 'Highest',
  urgent: 'Highest',
  highest: 'Highest',
  high: 'High',
  normal: 'Medium',
  medium: 'Medium',
  low: 'Low',
  lowest: 'Lowest',
};

const createJiraIssueArgsSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Jira issue summary; use this or title',
    },
    title: {
      type: 'string',
      description: 'Common issue title; use this or summary',
    },
    description: {
      type: 'string',
      description: 'Jira issue description; use this or body',
    },
    body: {
      type: 'string',
      description: 'Common issue body; use this or description',
    },
    projectKey: {
      type: 'string',
      description: 'Optional Jira project key override',
    },
    issueType: {
      type: 'string',
      description: 'Optional Jira issue type',
    },
    labels: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional issue labels',
    },
    priority: {
      type: 'string',
      description: 'Optional Jira priority name or common priority label such as low, normal, high, or urgent',
    },
    ticketId: {
      type: 'string',
      description: 'Optional source ticket id',
    },
    fields: {
      type: 'object',
      description: 'Advanced Jira fields override',
    },
  },
};

const issueGetArgsSchema = {
  type: 'object',
  required: ['key'],
  properties: {
    key: {
      type: 'string',
      description: 'Jira issue key, for example KAN-7',
    },
  },
};

const issueCommentArgsSchema = {
  type: 'object',
  required: ['key', 'body'],
  properties: {
    key: {
      type: 'string',
      description: 'Jira issue key, for example KAN-7',
    },
    body: {
      type: 'string',
      description: 'Comment body, for example a review status summary',
    },
  },
};

export function jiraConnector(options: JiraConnectorOptions = {}): ConnectorDefinition<JiraConnectorConfig> {
  const mode = options.mode ?? 'local';
  const baseUrlEnv = options.baseUrlEnv ?? 'JIRA_BASE_URL';
  const emailEnv = options.emailEnv ?? 'JIRA_EMAIL';
  const apiTokenEnv = options.apiTokenEnv ?? 'JIRA_API_TOKEN';
  const projectKeyEnv = options.projectKeyEnv ?? 'JIRA_PROJECT_KEY';
  const issueType = options.issueType ?? 'Task';
  const baseUrl = options.baseUrl ? normalizeBaseUrl(options.baseUrl) : undefined;
  const http = createHttpReq(options.resilience);
  const fetchImpl = ((input, init) => http.request(options.fetch ?? globalThis.fetch, input, init)) as typeof globalThis.fetch;
  let localIssueCounter = 0;
  const createIssue = async (args: CreateJiraIssueArgs): Promise<CreateJiraIssueResult> => {
    localIssueCounter += 1;
    const projectKey = args.projectKey ?? options.projectKey ?? readEnvValue(projectKeyEnv, options.env);
    const summary = args.summary ?? args.title;
    const priority = normalizeJiraPriority(args.priority);

    if (!summary) {
      throw new Error('jira.issue.create requires summary or title');
    }

    if (mode === 'api') {
      if (!projectKey) {
        throw new Error(`Missing Jira project key; set ${projectKeyEnv} or pass projectKey to jira.issue.create`);
      }

      const siteUrl = baseUrl ?? readEnvValue(baseUrlEnv, options.env);

      if (!siteUrl) {
        throw new Error(`Missing Jira base URL; set ${baseUrlEnv} or pass jiraConnector({ baseUrl })`);
      }

      const response = await createJiraIssue({
        baseUrl: normalizeBaseUrl(siteUrl),
        email: requireEnv(emailEnv, 'Jira email', options.env),
        apiToken: requireEnv(apiTokenEnv, 'Jira API token', options.env),
        fetchImpl,
        fields: {
          project: { key: projectKey },
          issuetype: { name: args.issueType ?? issueType },
          summary,
          description: toAtlassianDocument(args.description ?? args.body ?? ''),
          labels: args.labels,
          priority: priority ? { name: priority } : undefined,
          ...args.fields,
        },
      });
      const record = asRecord(response);
      const key = getString(record.key) ?? `${projectKey}-${localIssueCounter}`;

      return {
        id: getString(record.id) ?? `jira_issue_${localIssueCounter}`,
        key,
        url: `${normalizeBaseUrl(siteUrl)}/browse/${key}`,
        mode,
        projectKey,
        ticketId: args.ticketId,
        response,
      };
    }

    const key = `${projectKey ?? 'FDE'}-${localIssueCounter}`;

    return {
      id: `local_jira_${localIssueCounter}`,
      key,
      url: `https://jira.local/browse/${key}`,
      mode,
      projectKey,
      ticketId: args.ticketId,
    };
  };

  const resolveApiAccess = () => {
    const siteUrl = baseUrl ?? readEnvValue(baseUrlEnv, options.env);

    if (!siteUrl) {
      throw new Error(`Missing Jira base URL; set ${baseUrlEnv} or pass jiraConnector({ baseUrl })`);
    }

    return {
      baseUrl: normalizeBaseUrl(siteUrl),
      email: requireEnv(emailEnv, 'Jira email', options.env),
      apiToken: requireEnv(apiTokenEnv, 'Jira API token', options.env),
    };
  };

  return defineConnector({
    name: 'jira',
    description: 'Create and read Jira issues and post comments; local mode returns deterministic fixtures; API mode calls Jira Cloud REST',
    config: {
      mode,
      baseUrl,
      baseUrlEnv,
      emailEnv,
      apiTokenEnv,
      projectKey: options.projectKey,
      projectKeyEnv,
      issueType,
    },
    env: mode === 'api'
      ? [
        {
          name: baseUrlEnv,
          required: !baseUrl,
          description: 'Jira Cloud site URL, for example https://company.atlassian.net',
        },
        {
          name: emailEnv,
          required: true,
          description: 'Jira account email for API token authentication',
        },
        {
          name: apiTokenEnv,
          required: true,
          description: 'Jira API token used to create issues',
        },
        {
          name: projectKeyEnv,
          required: !options.projectKey,
          description: 'Jira project key used when the tool call does not pass projectKey',
        },
      ]
      : [],
    tools: [
      defineTool<CreateJiraIssueArgs, CreateJiraIssueResult>({
        name: 'jira.issue.create',
        description: 'Create a Jira issue from an agent handoff',
        scopes: ['issues:write'],
        environments: defaultToolEnvironments,
        category: 'issue',
        tags: ['action', 'escalation', 'issue'],
        argsSchema: createJiraIssueArgsSchema,
        handler: createIssue,
      }),
      defineTool<CreateJiraIssueArgs, CreateJiraIssueResult>({
        name: 'issue.create',
        description: 'Create an engineering issue in Jira using the common issue.create capability',
        scopes: ['issues:write'],
        environments: defaultToolEnvironments,
        category: 'issue',
        tags: ['action', 'escalation', 'issue'],
        argsSchema: createJiraIssueArgsSchema,
        handler: createIssue,
      }),
      defineTool<JiraIssueGetArgs, JiraIssueGetResult>({
        name: 'jira.issue.get',
        description: 'Fetch a Jira issue (summary, description, status) referenced by a pull request, to check the implementation against its intent',
        scopes: ['issues:read'],
        environments: defaultToolEnvironments,
        category: 'issue',
        tags: ['context', 'issue', 'read', 'review'],
        argsSchema: issueGetArgsSchema,
        async handler(args) {
          const key = typeof args.key === 'string' ? args.key.trim() : '';

          if (!key) {
            throw new Error('jira.issue.get requires a non-empty issue key');
          }

          if (mode === 'api') {
            const access = resolveApiAccess();
            const response = await getJiraIssue({ ...access, fetchImpl, key });
            const record = asRecord(response);
            const fields = asRecord(record.fields);

            return {
              mode,
              key: getString(record.key) ?? key,
              id: getString(record.id),
              title: getString(fields.summary) ?? '',
              description: fromAtlassianDocument(fields.description),
              status: getString(asRecord(fields.status).name),
              url: `${access.baseUrl}/browse/${getString(record.key) ?? key}`,
              response,
            };
          }

          return {
            mode,
            key,
            id: `local_jira_${key}`,
            title: `Local fixture: ${key}`,
            description: 'Add retry handling with exponential backoff to the billing sync so transient failures do not block renewals.',
            status: 'In Progress',
            url: `https://jira.local/browse/${key}`,
          };
        },
      }),
      defineTool<JiraIssueCommentArgs, JiraIssueCommentResult>({
        name: 'jira.issue.comment',
        description: 'Post a short status comment back to a Jira issue, for example a review summary',
        scopes: ['issues:write'],
        environments: defaultToolEnvironments,
        category: 'issue',
        tags: ['action', 'issue', 'write', 'review'],
        argsSchema: issueCommentArgsSchema,
        async handler(args) {
          const key = typeof args.key === 'string' ? args.key.trim() : '';

          if (!key) {
            throw new Error('jira.issue.comment requires a non-empty issue key');
          }

          if (!args.body?.trim()) {
            throw new Error('jira.issue.comment requires a non-empty body');
          }

          if (mode === 'api') {
            const access = resolveApiAccess();
            const response = await createJiraComment({ ...access, fetchImpl, key, body: args.body });

            return {
              mode,
              key,
              posted: true,
              url: `${access.baseUrl}/browse/${key}`,
              response,
            };
          }

          return {
            mode,
            key,
            posted: true,
            url: `https://jira.local/browse/${key}#comment-local`,
          };
        },
      }),
    ],
  });
}

function normalizeJiraPriority(priority: string | undefined): string | undefined {
  const value = priority?.trim();

  if (!value) {
    return undefined;
  }

  return jiraPriorityAliases[value.toLowerCase()] ?? value;
}
