import type { EnvironmentCommandDefinition } from '@fdekit/core';
import type { DockerCommandConfig } from '../interfaces/index.js';
import { mergeEnv } from '@fdekit/core';

export function commandFromStringOrConfig(
  value: string | DockerCommandConfig,
  fallbackName: string,
  fallbackDescription: string,
  env?: Record<string, string | undefined>,
): EnvironmentCommandDefinition {
  if (typeof value === 'string') {
    return {
      name: fallbackName,
      command: value,
      description: fallbackDescription,
      env,
    };
  }

  return {
    name: value.name ?? fallbackName,
    command: value.command,
    description: value.description ?? fallbackDescription,
    cwd: value.cwd,
    env: mergeEnv(env, value.env),
    optional: value.optional,
  };
}
