import {
  asRecord,
  getString,
  requestConnectorJson,
  requireEnvValue,
} from '@fdekit/core';

export { asRecord, getNumber, getString, normalizeBaseUrl, readEnvValue } from '@fdekit/core';

export async function createGitHubIssue(options: {
  apiBaseUrl: string;
  token: string;
  fetchImpl: typeof globalThis.fetch;
  repository: string;
  title: string;
  body: string;
  labels: string[];
}): Promise<unknown> {
  return requestConnectorJson({
    connectorName: 'githubConnector API mode',
    fetchImpl: options.fetchImpl,
    url: `${options.apiBaseUrl}/repos/${options.repository}/issues`,
    init: {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.token}`,
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({
        title: options.title,
        body: options.body,
        labels: options.labels,
      }),
    },
    defaultHeaders: {
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
    errorMessage: (value, response) => {
      const message = getString(asRecord(value).message) ?? `${response.status} ${response.statusText}`;
      return `GitHub issue creation failed: ${message}`;
    },
  });
}

export function requireToken(tokenEnv: string, env?: Record<string, string | undefined>): string {
  return requireEnvValue(
    tokenEnv,
    `Missing GitHub token; set ${tokenEnv} or use githubConnector({ mode: 'local' })`,
    env,
  );
}
