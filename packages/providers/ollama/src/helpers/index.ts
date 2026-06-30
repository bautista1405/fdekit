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
  const apiBaseUrl = getString(config.options?.apiBaseUrl) ?? defaultBaseUrl;
  const model = config.model ?? defaultModel;

  try {
    return await requestProviderJson({
      providerName: 'Ollama',
      fetch: options.fetch,
      resilience,
      apiBaseUrl,
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
          model,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.startsWith('Ollama chat failed:')
      && (message.includes('404') || message.toLowerCase().includes('not found'))) {
      throw new Error(ollamaMissingModelMessage(model, apiBaseUrl));
    }

    throw err;
  }
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

function ollamaMissingModelMessage(model: string, apiBaseUrl: string): string {
  return `model "${model}" not found on ${apiBaseUrl} - pull it or set FDEKIT_MODEL`;
}

export { getHttpResilienceOptions };
