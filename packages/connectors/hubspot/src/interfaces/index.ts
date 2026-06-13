import type { HttpResilienceOptions } from '@fdekit/core';

export type HubSpotConnectorMode = 'local' | 'api';

export interface HubSpotConnectorConfig {
  mode: HubSpotConnectorMode;
  apiBaseUrl: string;
  accessTokenEnv: string;
  portalId?: string;
  portalIdEnv: string;
}

export interface HubSpotConnectorOptions {
  mode?: HubSpotConnectorMode;
  apiBaseUrl?: string;
  accessTokenEnv?: string;
  portalId?: string;
  portalIdEnv?: string;
  fetch?: typeof globalThis.fetch;
  env?: Record<string, string | undefined>;
  resilience?: HttpResilienceOptions;
}

export interface HubSpotAssociationType {
  associationCategory: string;
  associationTypeId: number;
}

export interface HubSpotAssociation {
  to: {
    id: string;
  };
  types: HubSpotAssociationType[];
}

export interface CreateHubSpotNoteArgs {
  accountId?: string;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  ownerId?: string;
  title?: string;
  summary?: string;
  body?: string;
  note?: string;
  nextStep?: string;
  timestamp?: string;
  associations?: HubSpotAssociation[];
  properties?: Record<string, unknown>;
}

export interface CreateHubSpotNoteResult {
  id: string;
  mode: HubSpotConnectorMode;
  provider: 'hubspot';
  title?: string;
  body: string;
  accountId?: string;
  companyId?: string;
  url?: string;
  response?: unknown;
}
