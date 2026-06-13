import {
  asArray,
  asRecord,
  buildProviderPlannerInput,
  buildProviderPlannerInstructions,
  compactRecord,
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
import type { GoogleGenAIClient, GoogleRuntimeOptions } from '../interfaces/index.js';

export const defaultGoogleModel = 'gemini-3.5-flash';

const defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

export async function generateContent(
  config: ProviderConfig,
  context: ProviderPlanContext,
  options: GoogleRuntimeOptions,
  resilience: HttpResilienceClient,
): Promise<unknown> {
  const client = options.client ?? injectedClient(config.options?.client);

  if (client) {
    return client.models.generateContent({
      model: config.model ?? defaultGoogleModel,
      contents: [
        {
          parts: [
            {
              text: buildProviderPlannerInput(context),
            },
          ],
        },
      ],
      config: compactRecord({
        systemInstruction: buildProviderPlannerInstructions(context),
        maxOutputTokens: getNumber(config.options?.maxOutputTokens) ?? 800,
        responseMimeType: getString(config.options?.responseMimeType) ?? 'application/json',
        temperature: getNumber(config.options?.temperature) ?? 1,
      }),
    });
  }

  const model = modelPath(config.model ?? defaultGoogleModel);

  return requestProviderJson({
    providerName: 'Google Gemini',
    fetch: options.fetch,
    resilience,
    apiBaseUrl: getString(config.options?.apiBaseUrl) ?? defaultBaseUrl,
    path: `/${model}:generateContent`,
    errorPrefix: 'Google Gemini generateContent failed',
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': requireProviderApiKey('Google Gemini', config.apiKeyEnv ?? 'GEMINI_API_KEY', options.env),
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: buildProviderPlannerInstructions(context),
            },
          ],
        },
        contents: [
          {
            parts: [
              {
                text: buildProviderPlannerInput(context),
              },
            ],
          },
        ],
        generationConfig: compactRecord({
          maxOutputTokens: getNumber(config.options?.maxOutputTokens) ?? 800,
          responseMimeType: getString(config.options?.responseMimeType) ?? 'application/json',
          temperature: getNumber(config.options?.temperature) ?? 1,
        }),
      }),
    },
  });
}

export function extractGeminiText(response: unknown): string {
  const record = asRecord(response);

  for (const candidate of asArray(record.candidates)) {
    const content = asRecord(asRecord(candidate).content);

    for (const part of asArray(content.parts)) {
      const text = getString(asRecord(part).text);

      if (text) {
        return text;
      }
    }
  }

  throw new Error('Google Gemini response did not include text output');
}

export function parseProviderStep(text: string): ProviderStep {
  return parseProviderPlannerStep(text, 'Google Gemini');
}

function modelPath(model: string): string {
  return model.startsWith('models/') ? model : `models/${model}`;
}

function injectedClient(value: unknown): GoogleGenAIClient | undefined {
  const models = asRecord(asRecord(value).models);
  return typeof models.generateContent === 'function' ? value as GoogleGenAIClient : undefined;
}

export { getHttpResilienceOptions };
