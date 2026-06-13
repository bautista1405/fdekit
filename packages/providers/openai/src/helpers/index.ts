import {
  asArray,
  asRecord,
  buildProviderPlannerInput,
  buildProviderPlannerInstructions,
  getNumber,
  getString,
  getHttpResilienceOptions,
  parseProviderPlannerStep,
  requestProviderJson,
  requireProviderApiKey,
  type HttpResilienceClient,
  type ProviderConfig,
  type ProviderPlanContext,
  type ProviderStep,
} from '@fdekit/core';
import type { OpenAIResponsesClient, OpenAIRuntimeOptions } from '../interfaces/index.js';

export const defaultOpenAIModel = 'gpt-5.5';

export async function createResponse(
  config: ProviderConfig,
  context: ProviderPlanContext,
  options: OpenAIRuntimeOptions,
  resilience: HttpResilienceClient,
): Promise<unknown> {
  const client = options.client ?? injectedClient(config.options?.client);

  if (client) {
    return client.responses.create({
      model: config.model ?? defaultOpenAIModel,
      instructions: buildProviderPlannerInstructions(context),
      input: buildProviderPlannerInput(context),
      max_output_tokens: getNumber(config.options?.maxOutputTokens) ?? 800,
    });
  }

  return requestProviderJson({
    providerName: 'OpenAI',
    fetch: options.fetch,
    resilience,
    apiBaseUrl: getString(config.options?.apiBaseUrl) ?? 'https://api.openai.com/v1',
    path: '/responses',
    errorPrefix: 'OpenAI response failed',
    init: {
      method: 'POST',
      headers: {
        authorization: `Bearer ${requireProviderApiKey('OpenAI', config.apiKeyEnv ?? 'OPENAI_API_KEY', options.env)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model ?? defaultOpenAIModel,
        instructions: buildProviderPlannerInstructions(context),
        input: buildProviderPlannerInput(context),
        max_output_tokens: getNumber(config.options?.maxOutputTokens) ?? 800,
      }),
    },
  });
}

export function extractOpenAIText(response: unknown): string {
  const record = asRecord(response);
  const outputText = getString(record.output_text);

  if (outputText) {
    return outputText;
  }

  for (const item of asArray(record.output)) {
    const itemRecord = asRecord(item);
    for (const content of asArray(itemRecord.content)) {
      const contentRecord = asRecord(content);
      const text = getString(contentRecord.text);

      if (text) {
        return text;
      }
    }
  }

  throw new Error('OpenAI response did not include text output');
}

export function parseProviderStep(text: string): ProviderStep {
  return parseProviderPlannerStep(text, 'OpenAI');
}

function injectedClient(value: unknown): OpenAIResponsesClient | undefined {
  const responses = asRecord(asRecord(value).responses);
  return typeof responses.create === 'function' ? value as OpenAIResponsesClient : undefined;
}

export { getHttpResilienceOptions };
