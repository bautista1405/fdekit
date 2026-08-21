import {
  asArray,
  asRecord,
  buildProviderPlannerInput,
  buildProviderPlannerInstructions,
  getNumber,
  getString,
  getHttpResilienceOptions,
  parseProviderPlannerStep,
  providerOutputTokenLimit,
  requestProviderJson,
  requireProviderApiKey,
  type HttpResilienceClient,
  type ProviderConfig,
  type ProviderPlanContext,
  type ProviderStep,
  type ProviderUsage,
} from '@fdekit/core';
import type { AnthropicMessagesClient, AnthropicRuntimeOptions } from '../interfaces/index.js';

export const defaultAnthropicModel = 'claude-opus-4-8';

export async function createMessage(
  config: ProviderConfig,
  context: ProviderPlanContext,
  options: AnthropicRuntimeOptions,
  resilience: HttpResilienceClient,
): Promise<unknown> {
  const client = options.client ?? injectedClient(config.options?.client);

  if (client) {
    return client.messages.create({
      model: config.model ?? defaultAnthropicModel,
      max_tokens: providerOutputTokenLimit(context, getNumber(config.options?.maxTokens) ?? 800),
      system: buildProviderPlannerInstructions(context),
      messages: [
        {
          role: 'user',
          content: buildProviderPlannerInput(context),
        },
      ],
    });
  }

  return requestProviderJson({
    providerName: 'Anthropic',
    fetch: options.fetch,
    resilience,
    apiBaseUrl: getString(config.options?.apiBaseUrl) ?? 'https://api.anthropic.com/v1',
    path: '/messages',
    errorPrefix: 'Anthropic message failed',
    init: {
      method: 'POST',
      headers: {
        'anthropic-version': getString(config.options?.anthropicVersion) ?? '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': requireProviderApiKey('Anthropic', config.apiKeyEnv ?? 'ANTHROPIC_API_KEY', options.env),
      },
      body: JSON.stringify({
        model: config.model ?? defaultAnthropicModel,
        max_tokens: providerOutputTokenLimit(context, getNumber(config.options?.maxTokens) ?? 800),
        system: buildProviderPlannerInstructions(context),
        messages: [
          {
            role: 'user',
            content: buildProviderPlannerInput(context),
          },
        ],
      }),
    },
  });
}

export function extractAnthropicText(response: unknown): string {
  const record = asRecord(response);

  for (const content of asArray(record.content)) {
    const contentRecord = asRecord(content);
    const text = getString(contentRecord.text);

    if (text) {
      return text;
    }
  }

  throw new Error('Anthropic response did not include text output');
}

export function extractAnthropicUsage(response: unknown): ProviderUsage | undefined {
  const usage = asRecord(asRecord(response).usage);
  const uncachedInputTokens = getNumber(usage.input_tokens);
  const cachedInputTokens = getNumber(usage.cache_read_input_tokens);
  const cacheWriteInputTokens = getNumber(usage.cache_creation_input_tokens);
  const inputParts = [uncachedInputTokens, cachedInputTokens, cacheWriteInputTokens]
    .filter((value): value is number => value !== undefined);
  const normalized: ProviderUsage = {
    inputTokens: inputParts.length > 0
      ? inputParts.reduce((total, value) => total + value, 0)
      : undefined,
    cachedInputTokens,
    cacheWriteInputTokens,
    outputTokens: getNumber(usage.output_tokens),
  };
  const entries = Object.entries(normalized).filter(([, value]) => value !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function parseProviderStep(text: string): ProviderStep {
  return parseProviderPlannerStep(text, 'Anthropic');
}

function injectedClient(value: unknown): AnthropicMessagesClient | undefined {
  const messages = asRecord(asRecord(value).messages);
  return typeof messages.create === 'function' ? value as AnthropicMessagesClient : undefined;
}

export { getHttpResilienceOptions };
