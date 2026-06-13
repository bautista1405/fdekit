import type { ProviderRuntimeRegistry } from '@fdekit/core';
import { createAnthropicProvider } from '@fdekit/provider-anthropic';
import { createGoogleProvider } from '@fdekit/provider-google';
import { createOllamaProvider } from '@fdekit/provider-ollama';
import { createOpenAIProvider } from '@fdekit/provider-openai';

export const builtinProviderRegistry: ProviderRuntimeRegistry = {
  anthropic: createAnthropicProvider,
  google: createGoogleProvider,
  localOllama: createOllamaProvider,
  ollama: createOllamaProvider,
  openai: createOpenAIProvider,
};
