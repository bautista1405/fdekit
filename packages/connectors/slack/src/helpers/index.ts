import {
  asRecord,
  getString,
  requestConnectorJson,
  requireEnvValue,
} from '@fdekit/core';

export { asRecord, getString, normalizeBaseUrl, readEnvValue } from '@fdekit/core';

export async function postSlackMessage(options: {
  apiBaseUrl: string;
  token: string;
  fetchImpl: typeof globalThis.fetch;
  channel: string;
  text: string;
}): Promise<unknown> {
  return requestConnectorJson({
    connectorName: 'slackConnector API mode',
    fetchImpl: options.fetchImpl,
    url: `${options.apiBaseUrl}/chat.postMessage`,
    init: {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify({
        channel: options.channel,
        text: options.text,
      }),
    },
    defaultHeaders: {
      'content-type': 'application/json; charset=utf-8',
    },
    isSuccessful: (value) => asRecord(value).ok !== false,
    errorMessage: (value, response) => {
      const reason = getString(asRecord(value).error) ?? `${response.status} ${response.statusText}`;
      return `Slack chat.postMessage failed: ${reason}`;
    },
  });
}

export function requireToken(tokenEnv: string, env?: Record<string, string | undefined>): string {
  return requireEnvValue(
    tokenEnv,
    `Missing Slack token; set ${tokenEnv} or use slackConnector({ mode: 'local' })`,
    env,
  );
}
