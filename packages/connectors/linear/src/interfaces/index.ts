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
  priority?: number;
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
