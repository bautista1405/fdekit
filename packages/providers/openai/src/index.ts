import {
  createHttpReq,
  type AgentProvider,
  type ProviderConfig,
} from '@fdekit/core';
import { createResponse, defaultOpenAIModel, extractOpenAIText, getHttpResilienceOptions, parseProviderStep } from './helpers/index.js';
import type { OpenAIProviderOptions, OpenAIRuntimeOptions } from './interfaces/index.js';
export type { OpenAIProviderOptions, OpenAIResponsesClient, OpenAIRuntimeOptions } from './interfaces/index.js';

export function openaiProvider(options: OpenAIProviderOptions = {}): ProviderConfig {
  const apiKeyEnv = options.apiKeyEnv ?? 'OPENAI_API_KEY';

  return {
    name: 'openai',
    model: options.model ?? defaultOpenAIModel,
    apiKeyEnv,
    runtime: createOpenAIProvider,
    env: [
      {
        name: apiKeyEnv,
        required: !options.client,
        description: 'OpenAI API key used by the runtime provider adapter; not required when an injected SDK client is provided',
      },
    ],
    options: {
      apiBaseUrl: options.apiBaseUrl ?? 'https://api.openai.com/v1',
      maxOutputTokens: options.maxOutputTokens ?? 800,
      resilience: options.resilience,
      client: options.client,
    },
  };
}

export function createOpenAIProvider(
  config: ProviderConfig = openaiProvider(),
  options: OpenAIRuntimeOptions = {},
): AgentProvider {
  const resilience = createHttpReq(options.resilience ?? getHttpResilienceOptions(config.options?.resilience));

  return {
    name: 'openai',
    async planNextStep(context) {
      const response = await createResponse(config, context, options, resilience);
      return parseProviderStep(extractOpenAIText(response));
    },
  };
}
