import type { CreateHubSpotNoteArgs, HubSpotAssociation } from '../interfaces/index.js';

import {
  asRecord,
  compactObject,
  defaultConnectorErrorMessage,
  getString,
  isNonEmptyString,
  requestConnectorJson,
  requireEnvValue,
} from '@fdekit/core';

export { asRecord, compactObject, getString, normalizeBaseUrl, readEnvValue } from '@fdekit/core';

export async function createHubSpotNote(options: {
  apiBaseUrl: string;
  token: string;
  fetchImpl: typeof globalThis.fetch;
  properties: Record<string, unknown>;
  associations?: HubSpotAssociation[];
}): Promise<unknown> {
  return requestConnectorJson({
    connectorName: 'hubspotConnector API mode',
    fetchImpl: options.fetchImpl,
    url: `${options.apiBaseUrl}/crm/v3/objects/notes`,
    init: {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify(compactObject({
        properties: options.properties,
        associations: options.associations,
      })),
    },
    defaultHeaders: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    errorMessage: (value, response, bodyText) =>
      `HubSpot note creation failed: ${defaultConnectorErrorMessage(value, response, bodyText)}`,
  });
}

export function formatNoteBody(args: CreateHubSpotNoteArgs): string {
  return [
    args.title,
    args.summary ?? args.body ?? args.note,
    args.nextStep ? `Next step: ${args.nextStep}` : undefined,
  ].filter(isNonEmptyString).join('\n\n');
}

export function requireToken(tokenEnv: string, env?: Record<string, string | undefined>): string {
  return requireEnvValue(
    tokenEnv,
    `Missing HubSpot access token; set ${tokenEnv} or use hubspotConnector({ mode: 'local' })`,
    env,
  );
}

export function hubSpotObjectUrl(portalId: string | undefined, noteId: string): string | undefined {
  return portalId ? `https://app.hubspot.com/contacts/${portalId}/record/0-46/${noteId}` : undefined;
}
