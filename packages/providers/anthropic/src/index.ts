import {
  createHttpReq,
  type AgentProvider,
  type ProviderConfig,
} from '@fdekit/core';
import { createMessage, defaultAnthropicModel, extractAnthropicText, getHttpResilienceOptions, parseProviderStep } from './helpers/index.js';
import type { AnthropicProviderOptions, AnthropicRuntimeOptions } from './interfaces/index.js';
export type { AnthropicMessagesClient, AnthropicProviderOptions, AnthropicRuntimeOptions } from './interfaces/index.js';

export function anthropicProvider(options: AnthropicProviderOptions = {}): ProviderConfig {
  const apiKeyEnv = options.apiKeyEnv ?? 'ANTHROPIC_API_KEY';

  return {
    name: 'anthropic',
    model: options.model ?? defaultAnthropicModel,
    apiKeyEnv,
    runtime: createAnthropicProvider,
    env: [
      {
        name: apiKeyEnv,
        required: !options.client,
        description: 'Anthropic API key used by the runtime provider adapter; not required when an injected SDK client is provided',
      },
    ],
    options: {
      apiBaseUrl: options.apiBaseUrl ?? 'https://api.anthropic.com/v1',
      anthropicVersion: options.anthropicVersion ?? '2023-06-01',
      maxTokens: options.maxTokens ?? 800,
      resilience: options.resilience,
      client: options.client,
    },
  };
}

export function createAnthropicProvider(
  config: ProviderConfig = anthropicProvider(),
  options: AnthropicRuntimeOptions = {},
): AgentProvider {
  const resilience = createHttpReq(options.resilience ?? getHttpResilienceOptions(config.options?.resilience));

  return {
    name: 'anthropic',
    async planNextStep(context) {
      const response = await createMessage(config, context, options, resilience);
      return parseProviderStep(extractAnthropicText(response));
    },
  };
}
