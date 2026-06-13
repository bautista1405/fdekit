import type { ProviderConfig, ProviderRuntimeRegistry } from '@fdekit/core';
import type { CompiledProviderPlan } from '../interfaces/index.js';
import { envNames, resolveProviderRuntime, sortedEntries } from './shared.js';

export function compileProviders(
  providers: Record<string, ProviderConfig>,
  registry: ProviderRuntimeRegistry,
): Record<string, CompiledProviderPlan> {
  return Object.fromEntries(sortedEntries(providers).map(([key, provider]) => [
    key,
    compileProvider(key, provider, registry),
  ]));
}

function compileProvider(
  key: string,
  provider: ProviderConfig,
  registry: ProviderRuntimeRegistry,
): CompiledProviderPlan {
  return {
    key,
    name: provider.name,
    model: provider.model,
    apiKeyEnv: provider.apiKeyEnv,
    env: envNames(provider.env),
    optionKeys: Object.keys(provider.options ?? {}).sort(),
    runtime: resolveProviderRuntime(key, provider, registry),
  };
}
