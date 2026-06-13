import type { EnvironmentCommandDefinition } from '@fdekit/core';
import {
  commandFromStringOrConfig,
  dockerComposeStartCommand,
  dockerComposeStopCommand,
} from '../helpers/index.js';
import type { DockerEnvironmentOptions, DockerSeedConfig } from '../interfaces/index.js';

export function createStartCommands(
  options: DockerEnvironmentOptions,
  resolved: {
    composeCommand: string;
    composeFile: string;
    profiles: string[];
    services: string[];
    baseEnv?: Record<string, string | undefined>;
  },
): EnvironmentCommandDefinition[] {
  const startCommand = options.startCommand === false
    ? undefined
    : options.startCommand ?? dockerComposeStartCommand({
      composeCommand: resolved.composeCommand,
      composeFile: resolved.composeFile,
      projectName: options.projectName,
      envFile: options.envFile,
      profiles: resolved.profiles,
      services: resolved.services,
    });

  return startCommand
    ? [commandFromStringOrConfig(startCommand, 'docker.start', 'Start the local Docker Compose customer environment', resolved.baseEnv)]
    : [];
}

export function createStopCommands(
  options: DockerEnvironmentOptions,
  resolved: {
    composeCommand: string;
    composeFile: string;
    profiles: string[];
    baseEnv?: Record<string, string | undefined>;
  },
): EnvironmentCommandDefinition[] {
  if (options.stopCommand === false) {
    return [];
  }

  return [
    commandFromStringOrConfig(
      options.stopCommand ?? dockerComposeStopCommand({
        composeCommand: resolved.composeCommand,
        composeFile: resolved.composeFile,
        projectName: options.projectName,
        envFile: options.envFile,
        profiles: resolved.profiles,
      }),
      'docker.stop',
      'Stop the local Docker Compose customer environment',
      resolved.baseEnv,
    ),
  ];
}

export function createSeedCommands(
  seed: string | DockerSeedConfig | undefined,
  baseEnv?: Record<string, string | undefined>,
): EnvironmentCommandDefinition[] {
  return seed
    ? [commandFromStringOrConfig(seed, 'docker.seed', 'Seed the local Docker/customer environment', baseEnv)]
    : [];
}
