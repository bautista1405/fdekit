import {
  asRecord,
  compactObject,
  getString,
  requestConnectorJson,
  requireEnvValue,
} from '@fdekit/core';

export { asRecord, compactObject, getString, normalizeBaseUrl, readEnvValue } from '@fdekit/core';

export async function createLinearIssue(options: {
  apiBaseUrl: string;
  token: string;
  fetchImpl: typeof globalThis.fetch;
  input: Record<string, unknown>;
}): Promise<unknown> {
  const value = await requestConnectorJson({
    connectorName: 'linearConnector API mode',
    fetchImpl: options.fetchImpl,
    url: options.apiBaseUrl,
    init: {
      method: 'POST',
      headers: {
        authorization: options.token,
      },
      body: JSON.stringify({
        query: `mutation FDEKitIssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue {
      id
      identifier
      title
      url
    }
  }
}`,
        variables: {
          input: compactObject(options.input),
        },
      }),
    },
    defaultHeaders: {
      'content-type': 'application/json',
    },
    isSuccessful: (responseValue) => !asRecord(responseValue).errors,
    errorMessage: (responseValue, response) => `Linear issue creation failed: ${graphqlErrorMessage(responseValue, response)}`,
  });

  const payload = asRecord(asRecord(value).data).issueCreate;

  if (asRecord(payload).success === false) {
    throw new Error('Linear issue creation failed: mutation returned success=false');
  }

  return value;
}

export function requireToken(tokenEnv: string, env?: Record<string, string | undefined>): string {
  return requireEnvValue(
    tokenEnv,
    `Missing Linear API key; set ${tokenEnv} or use linearConnector({ mode: 'local' })`,
    env,
  );
}

function graphqlErrorMessage(value: unknown, response: Response): string {
  const errors = asRecord(value).errors;

  if (Array.isArray(errors)) {
    const messages = errors.map((error) => getString(asRecord(error).message)).filter(Boolean);

    if (messages.length > 0) {
      return messages.join('; ');
    }
  }

  return `${response.status} ${response.statusText}`;
}
