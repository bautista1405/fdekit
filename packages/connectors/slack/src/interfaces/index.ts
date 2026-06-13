import type { HttpResilienceOptions } from '@fdekit/core';

export type SlackConnectorMode = 'local' | 'api';

export interface SlackConnectorConfig {
  mode: SlackConnectorMode;
  defaultChannel: string;
  tokenEnv?: string;
  channelEnv?: string;
  apiBaseUrl?: string;
}

export interface SlackConnectorOptions {
  mode?: SlackConnectorMode;
  defaultChannel?: string;
  tokenEnv?: string;
  channelEnv?: string;
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
  env?: Record<string, string | undefined>;
  now?: () => string;
  resilience?: HttpResilienceOptions;
}

export interface SlackMessageArgs {
  channel?: string;
  text: string;
  ticketId?: string;
}

export interface SlackMessageResult {
  ok: boolean;
  mode: SlackConnectorMode;
  channel: string;
  text: string;
  ticketId?: string;
  ts: string;
  response?: unknown;
}
