import type {
  DeploymentDefinition,
  EnvironmentVariableRequirement,
  ProviderConfig,
} from '@fdekit/core';
import type { CompiledEnvRequirement } from '../interfaces/index.js';
import { compareByName, sortedEntries } from './shared.js';

export function compileEnvRequirements(deployment: DeploymentDefinition): CompiledEnvRequirement[] {
  const env = new Map<string, CompiledEnvRequirement>();

  for (const [key, provider] of sortedEntries(deployment.providers ?? {})) {
    for (const requirement of providerEnvRequirements(provider)) {
      addEnvRequirement(env, requirement, `providers.${key}`);
    }
  }

  for (const [key, connector] of sortedEntries(deployment.connectors ?? {})) {
    for (const requirement of connector.env ?? []) {
      addEnvRequirement(env, requirement, `connectors.${key}`);
    }
  }

  return [...env.values()].sort(compareByName);
}

function providerEnvRequirements(provider: ProviderConfig): EnvironmentVariableRequirement[] {
  const requirements = [...(provider.env ?? [])];

  if (provider.apiKeyEnv && !requirements.some((requirement) => requirement.name === provider.apiKeyEnv)) {
    requirements.push({
      name: provider.apiKeyEnv,
      required: true,
      description: `API key used by provider "${provider.name}"`,
    });
  }

  return requirements;
}

function addEnvRequirement(
  env: Map<string, CompiledEnvRequirement>,
  requirement: EnvironmentVariableRequirement,
  source: string,
): void {
  if (!requirement.name) {
    return;
  }

  const existing = env.get(requirement.name);

  if (!existing) {
    env.set(requirement.name, {
      name: requirement.name,
      required: Boolean(requirement.required),
      description: requirement.description,
      sources: [source],
    });
    return;
  }

  existing.required = existing.required || Boolean(requirement.required);
  existing.description ??= requirement.description;
  if (!existing.sources.includes(source)) {
    existing.sources.push(source);
    existing.sources.sort();
  }
}
