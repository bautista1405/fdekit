import { createHttpReq, defineConnector, defineTool, type ConnectorDefinition } from '@fdekit/core';
import { asRecord, getString, normalizeBaseUrl, postSlackMessage, readEnvValue, renderReviewNotification, requireToken } from './helpers/index.js';
import type { SlackConnectorConfig, SlackConnectorMode, SlackConnectorOptions, SlackMessageArgs, SlackMessageResult, SlackNotifyArgs, SlackNotifyResult } from './interfaces/index.js';
export type { SlackConnectorConfig, SlackConnectorMode, SlackConnectorOptions, SlackMessageArgs, SlackMessageResult, SlackNotifyArgs, SlackNotifyResult } from './interfaces/index.js';

const defaultToolEnvironments = ['local', 'development', 'staging'];

const slackMessageArgsSchema = {
  type: 'object',
  required: ['text'],
  properties: {
    channel: {
      type: 'string',
      description: 'Optional Slack channel override in local mode',
    },
    text: {
      type: 'string',
      description: 'Message text to post to the escalation channel',
    },
    ticketId: {
      type: 'string',
      description: 'Optional source ticket id for traceability',
    },
  },
};

const slackNotifyArgsSchema = {
  type: 'object',
  required: ['title', 'recommendation', 'prUrl'],
  properties: {
    title: {
      type: 'string',
      description: 'Pull request title',
    },
    recommendation: {
      type: 'string',
      enum: ['comment', 'request-changes'],
      description: 'Review recommendation for the human reviewer; approval always stays with humans',
    },
    prUrl: {
      type: 'string',
      description: 'Link to the posted review on the pull request',
    },
    ticketUrl: {
      type: 'string',
      description: 'Optional link to the linked ticket',
    },
    findingsSummary: {
      type: 'array',
      items: { type: 'string' },
      description: 'Top findings, one line each; the card renders at most 5',
    },
    riskReasons: {
      type: 'array',
      items: { type: 'string' },
      description: 'Risk-ranking reasons from codebase.rankDiff, for reviewer triage',
    },
    channel: {
      type: 'string',
      description: 'Optional Slack channel override in local mode',
    },
  },
};

export function slackConnector(options: SlackConnectorOptions = {}): ConnectorDefinition<SlackConnectorConfig> {
  const mode = options.mode ?? 'local';
  const tokenEnv = options.tokenEnv ?? 'SLACK_BOT_TOKEN';
  const channelEnv = options.channelEnv ?? 'SLACK_CHANNEL_ID';
  const defaultChannel = options.defaultChannel ?? readEnvValue(channelEnv, options.env) ?? '#support-escalations';
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl ?? 'https://slack.com/api');
  const http = createHttpReq(options.resilience);
  const fetchImpl = ((input, init) => http.request(options.fetch ?? globalThis.fetch, input, init)) as typeof globalThis.fetch;

  return defineConnector({
    name: 'slack',
    description: 'Send Slack escalation messages and reviewer notifications; local mode returns deterministic mock messages; API mode calls Slack chat.postMessage',
    config: {
      mode,
      defaultChannel,
      tokenEnv,
      channelEnv,
      apiBaseUrl,
    },
    env: mode === 'api'
      ? [
        {
          name: tokenEnv,
          required: true,
          description: 'Slack bot token used to call chat.postMessage',
        },
        {
          name: channelEnv,
          required: true,
          description: 'Slack channel ID or name used by the demo escalation message',
        },
      ]
      : [],
    tools: [
      defineTool<SlackMessageArgs, SlackMessageResult>({
        name: 'slack.message',
        description: 'Send a Slack message to an escalation channel',
        scopes: ['slack:write'],
        environments: defaultToolEnvironments,
        category: 'messaging',
        tags: ['action', 'escalation', 'message'],
        argsSchema: slackMessageArgsSchema,
        async handler(args) {
          const channel = mode === 'api' ? defaultChannel : args.channel ?? defaultChannel;

          if (mode === 'local') {
            return {
              ok: true,
              mode,
              channel,
              text: args.text,
              ticketId: args.ticketId,
              ts: options.now?.() ?? new Date().toISOString(),
            };
          }

          const response = await postSlackMessage({
            apiBaseUrl,
            token: requireToken(tokenEnv, options.env),
            fetchImpl,
            channel,
            text: args.text,
          });

          return {
            ok: true,
            mode,
            channel,
            text: args.text,
            ticketId: args.ticketId,
            ts: getString(asRecord(response).ts) ?? options.now?.() ?? new Date().toISOString(),
            response,
          };
        },
      }),
      defineTool<SlackNotifyArgs, SlackNotifyResult>({
        name: 'slack.notify',
        description: 'Notify human reviewers that a PR review is ready: recommendation, top findings, risk reasons, and links. Humans approve or reject on GitHub.',
        scopes: ['slack:write'],
        environments: defaultToolEnvironments,
        category: 'notification',
        tags: ['action', 'notification', 'review'],
        argsSchema: slackNotifyArgsSchema,
        async handler(args) {
          if (!args.title?.trim()) {
            throw new Error('slack.notify requires a non-empty title');
          }

          if (!args.prUrl?.trim()) {
            throw new Error('slack.notify requires a non-empty prUrl');
          }

          if (args.recommendation !== 'comment' && args.recommendation !== 'request-changes') {
            throw new Error('slack.notify recommendation must be "comment" or "request-changes"');
          }

          const channel = mode === 'api' ? defaultChannel : args.channel ?? defaultChannel;
          const text = renderReviewNotification(args);

          if (mode === 'local') {
            return {
              ok: true,
              mode,
              channel,
              text,
              ts: options.now?.() ?? new Date().toISOString(),
            };
          }

          const response = await postSlackMessage({
            apiBaseUrl,
            token: requireToken(tokenEnv, options.env),
            fetchImpl,
            channel,
            text,
          });

          return {
            ok: true,
            mode,
            channel,
            text,
            ts: getString(asRecord(response).ts) ?? options.now?.() ?? new Date().toISOString(),
            response,
          };
        },
      }),
    ],
  });
}
