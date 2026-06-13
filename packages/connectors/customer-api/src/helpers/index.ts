import { normalizeBaseUrl, requestConnectorJson } from '@fdekit/core';

export async function requestJson(
  baseUrl: string,
  apiPath: string,
  init: RequestInit | undefined,
  fetchImpl: typeof globalThis.fetch,
): Promise<unknown> {
  return requestConnectorJson({
    connectorName: 'customerApiConnector',
    fetchImpl,
    url: resolveRequestUrl(baseUrl, apiPath),
    init,
    defaultHeaders: {
      'content-type': 'application/json',
    },
    errorMessage: (_value, response, bodyText) =>
      `Customer API request failed: ${response.status} ${response.statusText}${bodyText ? ` - ${bodyText}` : ''}`,
  });
}

export { normalizeBaseUrl } from '@fdekit/core';

function resolveRequestUrl(baseUrl: string, apiPath: string): string {
  if (/^https?:\/\//.test(apiPath)) {
    return apiPath;
  }

  return apiPath.startsWith('/') ? `${baseUrl}${apiPath}` : `${baseUrl}/${apiPath}`;
}
