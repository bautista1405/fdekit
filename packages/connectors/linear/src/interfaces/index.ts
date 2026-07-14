import type { HttpResilienceOptions } from '@fdekit/core';

export type LinearConnectorMode = 'local' | 'api';

export interface LinearConnectorConfig {
  mode: LinearConnectorMode;
  apiBaseUrl: string;
  tokenEnv: string;
  teamId?: string;
  teamIdEnv: string;
}

export interface LinearConnectorOptions {
  mode?: LinearConnectorMode;
  apiBaseUrl?: string;
  tokenEnv?: string;
  teamId?: string;
  teamIdEnv?: string;
  fetch?: typeof globalThis.fetch;
  env?: Record<string, string | undefined>;
  resilience?: HttpResilienceOptions;
}

export interface CreateLinearIssueArgs {
  title: string;
  description?: string;
  body?: string;
  teamId?: string;
  priority?: number | string;
  labelIds?: string[];
  assigneeId?: string;
  ticketId?: string;
}

export interface CreateLinearIssueResult {
  id: string;
  identifier?: string;
  title: string;
  url?: string;
  mode: LinearConnectorMode;
  teamId?: string;
  ticketId?: string;
  response?: unknown;
}

export interface LinearIssueGetArgs {
  key: string;
}

export interface LinearIssueGetResult {
  mode: LinearConnectorMode;
  key: string;
  id?: string;
  title: string;
  description: string;
  state?: string;
  url?: string;
  response?: unknown;
}

export interface LinearIssueCommentArgs {
  key: string;
  body: string;
}

export interface LinearIssueCommentResult {
  mode: LinearConnectorMode;
  key: string;
  posted: boolean;
  url?: string;
  response?: unknown;
}
