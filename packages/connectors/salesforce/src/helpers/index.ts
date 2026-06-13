import {
  asRecord,
  compactObject,
  defaultConnectorErrorMessage,
  getString,
  isNonEmptyString,
  requestConnectorJson,
  requireEnvValue,
} from '@fdekit/core';
import type { CreateSalesforceTaskArgs } from '../interfaces/index.js';

export { asRecord, compactObject, getString, normalizeBaseUrl, readEnvValue } from '@fdekit/core';

export async function createSalesforceTask(options: {
  instanceUrl: string;
  accessToken: string;
  apiVersion: string;
  fetchImpl: typeof globalThis.fetch;
  fields: Record<string, unknown>;
}): Promise<unknown> {
  return requestConnectorJson({
    connectorName: 'salesforceConnector API mode',
    fetchImpl: options.fetchImpl,
    url: `${options.instanceUrl}/services/data/${options.apiVersion}/sobjects/Task/`,
    init: {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.accessToken}`,
      },
      body: JSON.stringify(compactObject(options.fields)),
    },
    defaultHeaders: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    errorMessage: (value, response, bodyText) =>
      `Salesforce task creation failed: ${salesforceErrorMessage(value, response, bodyText)}`,
  });
}

export function formatTaskBody(args: CreateSalesforceTaskArgs): string {
  return [
    args.summary ?? args.body ?? args.note,
    args.nextStep ? `Next step: ${args.nextStep}` : undefined,
  ].filter(isNonEmptyString).join('\n\n') || args.subject || args.title || '';
}

export function requireToken(tokenEnv: string, env?: Record<string, string | undefined>): string {
  return requireEnvValue(
    tokenEnv,
    `Missing Salesforce access token; set ${tokenEnv} or use salesforceConnector({ mode: 'local' })`,
    env,
  );
}

export function normalizeApiVersion(apiVersion: string): string {
  return apiVersion.startsWith('v') ? apiVersion : `v${apiVersion}`;
}

function salesforceErrorMessage(value: unknown, response: Response, bodyText: string): string {
  if (Array.isArray(value)) {
    const messages = value.map((item) => getString(asRecord(item).message)).filter(Boolean);

    if (messages.length > 0) {
      return messages.join('; ');
    }
  }

  return defaultConnectorErrorMessage(value, response, bodyText);
}
