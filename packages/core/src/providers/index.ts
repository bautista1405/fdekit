import { getString, readProcessEnv } from '../helpers/index.js';
import type { EnvironmentVariableRequirement, ProviderConfig } from '../types/index.js';

const environmentProviderNames = [
  'mock',
  'localOllama',
  'openai',
  'anthropic',
  'google',
] as const;

export type EnvironmentProviderName = typeof environmentProviderNames[number];

export interface ProviderFromEnvOptions {
  env?: Record<string, string | undefined>;
  fallback?: EnvironmentProviderName;
}

export function providerFromEnv(options: ProviderFromEnvOptions = {}): ProviderConfig {
  const env = options.env ?? readProcessEnv();
  const name = providerName(env.FDEKIT_PROVIDER, options.fallback ?? 'mock');
  const model = getString(env.FDEKIT_MODEL);
  const modelRequirement: EnvironmentVariableRequirement = {
    name: 'FDEKIT_MODEL',
    required: false,
    description: 'Optional model override; the selected provider supplies its default',
  };

  switch (name) {
    case 'openai':
      return keyedProvider(name, model, 'OPENAI_API_KEY', modelRequirement);
    case 'anthropic':
      return keyedProvider(name, model, 'ANTHROPIC_API_KEY', modelRequirement);
    case 'google':
      return keyedProvider(name, model, 'GEMINI_API_KEY', modelRequirement);
    case 'localOllama': {
      const apiBaseUrl = getString(env.OLLAMA_BASE_URL);

      return {
        name,
        model,
        env: [
          modelRequirement,
          {
            name: 'OLLAMA_BASE_URL',
            required: false,
            description: 'Optional Ollama server URL; defaults to http://127.0.0.1:11434',
          },
        ],
        options: apiBaseUrl ? { apiBaseUrl } : undefined,
      };
    }
    case 'mock':
      return {
        name,
        model,
        env: [modelRequirement],
      };
  }
}

function providerName(
  value: string | undefined,
  fallback: EnvironmentProviderName,
): EnvironmentProviderName {
  if (!value) {
    return fallback;
  }

  if (environmentProviderNames.includes(value as EnvironmentProviderName)) {
    return value as EnvironmentProviderName;
  }

  throw new Error(
    `Unsupported FDEKIT_PROVIDER "${value}". Use ${environmentProviderNames.join(', ')}`,
  );
}

function keyedProvider(
  name: 'openai' | 'anthropic' | 'google',
  model: string | undefined,
  apiKeyEnv: string,
  modelRequirement: EnvironmentVariableRequirement,
): ProviderConfig {
  return {
    name,
    model,
    apiKeyEnv,
    env: [modelRequirement],
  };
}
