import { asRecord, getString, readProcessEnv } from '../helpers/index.js';

export interface ConnectorJsonRequestOptions {
  connectorName: string;
  fetchImpl: typeof globalThis.fetch;
  url: string;
  init?: RequestInit;
  defaultHeaders?: Record<string, string>;
  isSuccessful?: (value: unknown, response: Response) => boolean;
  errorMessage?: (value: unknown, response: Response, bodyText: string) => string;
}

export async function requestConnectorJson(options: ConnectorJsonRequestOptions): Promise<unknown> {
  if (!options.fetchImpl) {
    throw new Error(`No fetch implementation is available for ${options.connectorName}`);
  }

  const response = await options.fetchImpl(options.url, {
    ...options.init,
    headers: {
      ...options.defaultHeaders,
      ...options.init?.headers,
    },
  });
  const bodyText = await response.text().catch(() => '');
  const value = parseJsonBody(bodyText);
  const successful = options.isSuccessful?.(value, response) ?? response.ok;

  if (!response.ok || !successful) {
    const message = options.errorMessage?.(value, response, bodyText)
      ?? defaultConnectorErrorMessage(value, response, bodyText);
    throw new Error(message);
  }

  return value;
}

export function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

export function readEnvValue(name: string, env = readProcessEnv()): string | undefined {
  return env[name];
}

export function requireEnvValue(
  name: string,
  message: string,
  env = readProcessEnv(),
): string {
  const value = env[name];

  if (!value) {
    throw new Error(message);
  }

  return value;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function defaultConnectorErrorMessage(
  value: unknown,
  response: Response,
  bodyText = '',
): string {
  const record = asRecord(value);
  return getString(record.message)
    ?? getString(record.error_description)
    ?? getString(record.error)
    ?? `${response.status} ${response.statusText}${bodyText ? ` - ${bodyText}` : ''}`;
}

function parseJsonBody(bodyText: string): unknown {
  if (!bodyText) {
    return {};
  }

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return {};
  }
}
