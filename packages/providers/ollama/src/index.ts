import {
  createHttpReq,
  type AgentProvider,
  type ProviderConfig,
} from '@fdekit/core';
import { createChat, extractOllamaText, getHttpResilienceOptions, parseProviderStep } from './helpers/index.js';
import type { OllamaProviderOptions, OllamaRuntimeOptions } from './interfaces/index.js';
export type { OllamaProviderOptions, OllamaRuntimeOptions } from './interfaces/index.js';

const defaultModel = 'llama3.1:8b';
const defaultBaseUrl = 'http://127.0.0.1:11434';

export function localOllamaProvider(options: OllamaProviderOptions = {}): ProviderConfig {
  return {
    ...ollamaProvider(options),
    name: 'localOllama',
  };
}

export function ollamaProvider(options: OllamaProviderOptions = {}): ProviderConfig {
  return {
    name: 'ollama',
    model: options.model ?? defaultModel,
    runtime: createOllamaProvider,
    env: [
      {
        name: 'OLLAMA_BASE_URL',
        required: false,
        description: 'Optional Ollama server URL; defaults to http://127.0.0.1:11434',
      },
      {
        name: 'FDEKIT_MODEL',
        required: false,
        description: `Optional model override for the selected provider; defaults to ${defaultModel}`,
      },
    ],
    options: {
      apiBaseUrl: options.apiBaseUrl ?? defaultBaseUrl,
      format: options.format ?? 'json',
      keepAlive: options.keepAlive ?? '5m',
      numPredict: options.numPredict ?? 800,
      temperature: options.temperature ?? 0,
      resilience: options.resilience,
    },
  };
}

export function createOllamaProvider(
  config: ProviderConfig = ollamaProvider(),
  options: OllamaRuntimeOptions = {},
): AgentProvider {
  const resilience = createHttpReq(options.resilience ?? getHttpResilienceOptions(config.options?.resilience));

  return {
    name: config.name,
    async planNextStep(context) {
      const response = await createChat(config, context, options, resilience);
      return parseProviderStep(extractOllamaText(response));
    },
  };
}
