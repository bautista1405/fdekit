import {
  asRecord,
  compactObject,
  getString,
  requestConnectorJson,
  requireEnvValue,
} from '@fdekit/core';

export { asRecord, compactObject, getString, normalizeBaseUrl, readEnvValue } from '@fdekit/core';

export async function createJiraIssue(options: {
  baseUrl: string;
  email: string;
  apiToken: string;
  fetchImpl: typeof globalThis.fetch;
  fields: Record<string, unknown>;
}): Promise<unknown> {
  return requestConnectorJson({
    connectorName: 'jiraConnector API mode',
    fetchImpl: options.fetchImpl,
    url: `${options.baseUrl}/rest/api/3/issue`,
    init: {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${options.email}:${options.apiToken}`)}`,
      },
      body: JSON.stringify({
        fields: compactObject(options.fields),
      }),
    },
    defaultHeaders: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    errorMessage: (value, response) => `Jira issue creation failed: ${jiraErrorMessage(value, response)}`,
  });
}

export function toAtlassianDocument(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: text
          ? [{ type: 'text', text }]
          : [],
      },
    ],
  };
}

export function requireEnv(name: string, label: string, env?: Record<string, string | undefined>): string {
  return requireEnvValue(
    name,
    `Missing ${label}; set ${name} or use jiraConnector({ mode: 'local' })`,
    env,
  );
}

function jiraErrorMessage(value: unknown, response: Response): string {
  const record = asRecord(value);
  const messages = [
    getString(record.errorMessages),
    ...(Array.isArray(record.errorMessages) ? record.errorMessages.map(String) : []),
    ...Object.values(asRecord(record.errors)).map(String),
  ].filter(Boolean);

  return messages.length > 0 ? messages.join('; ') : `${response.status} ${response.statusText}`;
}
