import {
  createHttpReq,
  type AgentProvider,
  type ProviderConfig,
} from '@fdekit/core';
import { defaultGoogleModel, extractGeminiText, generateContent, getHttpResilienceOptions, parseProviderStep } from './helpers/index.js';
import type { GoogleProviderOptions, GoogleRuntimeOptions } from './interfaces/index.js';
export type { GoogleGenAIClient, GoogleProviderOptions, GoogleRuntimeOptions } from './interfaces/index.js';

const defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

export function googleProvider(options: GoogleProviderOptions = {}): ProviderConfig {
  const apiKeyEnv = options.apiKeyEnv ?? 'GEMINI_API_KEY';

  return {
    name: 'google',
    model: options.model ?? defaultGoogleModel,
    apiKeyEnv,
    runtime: createGoogleProvider,
    env: [
      {
        name: apiKeyEnv,
        required: !options.client,
        description: 'Google Gemini API key used by the runtime provider adapter; not required when an injected SDK client is provided',
      },
    ],
    options: {
      apiBaseUrl: options.apiBaseUrl ?? defaultBaseUrl,
      maxOutputTokens: options.maxOutputTokens ?? 800,
      responseMimeType: options.responseMimeType ?? 'application/json',
      temperature: options.temperature ?? 1,
      resilience: options.resilience,
      client: options.client,
    },
  };
}

export const geminiProvider = googleProvider;

export function createGoogleProvider(
  config: ProviderConfig = googleProvider(),
  options: GoogleRuntimeOptions = {},
): AgentProvider {
  const resilience = createHttpReq(options.resilience ?? getHttpResilienceOptions(config.options?.resilience));

  return {
    name: 'google',
    async planNextStep(context) {
      const response = await generateContent(config, context, options, resilience);
      return parseProviderStep(extractGeminiText(response));
    },
  };
}
