import type { HttpResilienceOptions } from '@fdekit/core';

export type JiraConnectorMode = 'local' | 'api';

export interface JiraConnectorConfig {
  mode: JiraConnectorMode;
  baseUrl?: string;
  baseUrlEnv: string;
  emailEnv: string;
  apiTokenEnv: string;
  projectKey?: string;
  projectKeyEnv: string;
  issueType: string;
}

export interface JiraConnectorOptions {
  mode?: JiraConnectorMode;
  baseUrl?: string;
  baseUrlEnv?: string;
  emailEnv?: string;
  apiTokenEnv?: string;
  projectKey?: string;
  projectKeyEnv?: string;
  issueType?: string;
  fetch?: typeof globalThis.fetch;
  env?: Record<string, string | undefined>;
  resilience?: HttpResilienceOptions;
}

export interface CreateJiraIssueArgs {
  summary?: string;
  title?: string;
  description?: string;
  body?: string;
  projectKey?: string;
  issueType?: string;
  labels?: string[];
  priority?: string;
  ticketId?: string;
  fields?: Record<string, unknown>;
}

export interface CreateJiraIssueResult {
  id: string;
  key: string;
  url: string;
  mode: JiraConnectorMode;
  projectKey?: string;
  ticketId?: string;
  response?: unknown;
}
