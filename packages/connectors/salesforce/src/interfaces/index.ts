import type { HttpResilienceOptions } from '@fdekit/core';

export type SalesforceConnectorMode = 'local' | 'api';

export interface SalesforceConnectorConfig {
  mode: SalesforceConnectorMode;
  instanceUrl?: string;
  instanceUrlEnv: string;
  accessTokenEnv: string;
  apiVersion: string;
  defaultWhatId?: string;
  defaultWhatIdEnv: string;
}

export interface SalesforceConnectorOptions {
  mode?: SalesforceConnectorMode;
  instanceUrl?: string;
  instanceUrlEnv?: string;
  accessTokenEnv?: string;
  apiVersion?: string;
  defaultWhatId?: string;
  defaultWhatIdEnv?: string;
  fetch?: typeof globalThis.fetch;
  env?: Record<string, string | undefined>;
  resilience?: HttpResilienceOptions;
}

export interface CreateSalesforceTaskArgs {
  accountId?: string;
  whatId?: string;
  whoId?: string;
  ownerId?: string;
  title?: string;
  subject?: string;
  summary?: string;
  body?: string;
  note?: string;
  nextStep?: string;
  status?: string;
  priority?: string;
  activityDate?: string;
  fields?: Record<string, unknown>;
}

export interface CreateSalesforceTaskResult {
  id: string;
  mode: SalesforceConnectorMode;
  provider: 'salesforce';
  subject: string;
  body: string;
  accountId?: string;
  whatId?: string;
  url?: string;
  response?: unknown;
}
