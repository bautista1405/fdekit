import { createHttpReq, defineConnector, defineTool, type ConnectorDefinition } from '@fdekit/core';
import { asRecord, getString, normalizeBaseUrl, postSlackMessage, requireToken } from './helpers/index.js';
import type { SlackConnectorConfig, SlackConnectorMode, SlackConnectorOptions, SlackMessageArgs, SlackMessageResult } from './interfaces/index.js';
export type { SlackConnectorConfig, SlackConnectorMode, SlackConnectorOptions, SlackMessageArgs, SlackMessageResult } from './interfaces/index.js';

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

export function slackConnector(options: SlackConnectorOptions = {}): ConnectorDefinition<SlackConnectorConfig> {
  const mode = options.mode ?? 'local';
  const defaultChannel = options.defaultChannel ?? '#support-escalations';
  const tokenEnv = options.tokenEnv ?? 'SLACK_BOT_TOKEN';
  const channelEnv = options.channelEnv ?? 'SLACK_CHANNEL_ID';
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl ?? 'https://slack.com/api');
  const http = createHttpReq(options.resilience);
  const fetchImpl = ((input, init) => http.request(options.fetch ?? globalThis.fetch, input, init)) as typeof globalThis.fetch;

  return defineConnector({
    name: 'slack',
    description: 'Send Slack escalation messages; local mode returns deterministic mock messages; API mode calls Slack chat.postMessage',
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
    ],
  });
}
