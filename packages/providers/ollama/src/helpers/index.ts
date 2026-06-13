import {
  asRecord,
  buildProviderPlannerInput,
  buildProviderPlannerInstructions,
  compactRecord,
  getNumber,
  getString,
  getHttpResilienceOptions,
  parseProviderPlannerStep,
  requestProviderJson,
  type HttpResilienceClient,
  type ProviderConfig,
  type ProviderPlanContext,
  type ProviderStep,
} from '@fdekit/core';
import type { OllamaRuntimeOptions } from '../interfaces/index.js';

const defaultModel = 'llama3.1:8b';
const defaultBaseUrl = 'http://127.0.0.1:11434';

export async function createChat(
  config: ProviderConfig,
  context: ProviderPlanContext,
  options: OllamaRuntimeOptions,
  resilience: HttpResilienceClient,
): Promise<unknown> {
  return requestProviderJson({
    providerName: 'Ollama',
    fetch: options.fetch,
    resilience,
    apiBaseUrl: getString(config.options?.apiBaseUrl) ?? defaultBaseUrl,
    path: '/api/chat',
    errorPrefix: 'Ollama chat failed',
    requestFailureMessage: (apiBaseUrl, message) =>
      `Ollama request failed at ${apiBaseUrl}; is Ollama running? ${message}`,
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model ?? defaultModel,
        messages: [
          {
            role: 'system',
            content: buildProviderPlannerInstructions(context),
          },
          {
            role: 'user',
            content: buildProviderPlannerInput(context),
          },
        ],
        stream: false,
        format: config.options?.format ?? 'json',
        keep_alive: config.options?.keepAlive ?? '5m',
        options: compactRecord({
          num_predict: getNumber(config.options?.numPredict) ?? 800,
          temperature: getNumber(config.options?.temperature) ?? 0,
        }),
      }),
    },
  });
}

export function extractOllamaText(response: unknown): string {
  const record = asRecord(response);
  const message = asRecord(record.message);
  const content = getString(message.content);

  if (content) {
    return content;
  }

  const responseText = getString(record.response);

  if (responseText) {
    return responseText;
  }

  throw new Error('Ollama response did not include message content');
}

export function parseProviderStep(text: string): ProviderStep {
  return parseProviderPlannerStep(text, 'Ollama');
}

export { getHttpResilienceOptions };
