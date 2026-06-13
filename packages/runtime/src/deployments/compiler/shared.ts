import type { EnvironmentVariableRequirement, ProviderConfig, ProviderRuntimeRegistry } from '@fdekit/core';
import type { CompiledProviderPlan } from '../interfaces/index.js';

export interface KnownRefs {
  tools: Map<string, string>;
  policies: Map<string, string>;
  evals: Map<string, string>;
}

export function resolveProviderRuntime(
  providerKey: string,
  provider: ProviderConfig | undefined,
  registry: ProviderRuntimeRegistry,
): CompiledProviderPlan['runtime'] {
  if (provider?.runtime) {
    return { source: 'config-runtime' };
  }

  const registryKey = providerKey in registry
    ? providerKey
    : provider?.name && provider.name in registry
      ? provider.name
      : undefined;

  if (registryKey) {
    return { source: 'registry', registryKey };
  }

  if (providerKey === 'mock' || provider?.name === 'mock') {
    return { source: 'mock-fallback' };
  }

  return { source: provider ? 'missing' : 'not-configured' };
}

export function budgetAppliesToAgent(scope: string | undefined, agentName: string): boolean {
  return !scope || scope === 'deployment' || scope === `agent:${agentName}`;
}

export function envNames(requirements: EnvironmentVariableRequirement[] | undefined): string[] {
  return (requirements ?? []).map((requirement) => requirement.name).sort();
}

export function compareByName<T extends { name: string }>(left: T, right: T): number {
  return left.name.localeCompare(right.name);
}

export function sortedEntries<T>(record: Record<string, T>): Array<[string, T]> {
  return Object.entries(record).sort(([left], [right]) => left.localeCompare(right));
}

export function sortObject<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(sortedEntries(record));
}
