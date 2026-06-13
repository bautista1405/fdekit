import type { HttpResilienceOptions } from '@fdekit/core';

export type GitHubConnectorMode = 'local' | 'api';

export interface GitHubConnectorConfig {
  mode: GitHubConnectorMode;
  repository: string;
  tokenEnv?: string;
  repositoryEnv?: string;
  apiBaseUrl?: string;
}

export interface GitHubConnectorOptions {
  mode?: GitHubConnectorMode;
  repository?: string;
  tokenEnv?: string;
  repositoryEnv?: string;
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
  env?: Record<string, string | undefined>;
  resilience?: HttpResilienceOptions;
}

export interface CreateIssueArgs {
  ticketId?: string;
  title: string;
  body: string;
  priority?: string;
  labels?: string[];
}

export interface CreateIssueResult {
  id: string;
  number: number;
  mode: GitHubConnectorMode;
  repository: string;
  title: string;
  body: string;
  priority?: string;
  labels: string[];
  ticketId?: string;
  url: string;
  response?: unknown;
}
