import type { EnvironmentCommandDefinition } from '@fdekit/core';
import {
  commandFromStringOrConfig,
  dockerStartCommand,
  dockerStopCommand,
} from '../helpers/index.js';
import type {
  FlociCustomerApiConfig,
  FlociEnvironmentOptions,
  FlociSeedConfig,
} from '../interfaces/index.js';

export function createStartCommands(options: {
  startCommand?: FlociEnvironmentOptions['startCommand'];
  containerName: string;
  image: string;
  port: number;
  containerEnv?: Record<string, string | undefined>;
  mountDockerSocket?: boolean;
  portMappings?: string[];
  volumes?: string[];
  env?: Record<string, string | undefined>;
  customerApiStartCommand?: FlociCustomerApiConfig['startCommand'];
  baseEnv?: Record<string, string | undefined>;
}): EnvironmentCommandDefinition[] {
  const startCommand = options.startCommand === false
    ? undefined
    : options.startCommand ?? dockerStartCommand({
      containerName: options.containerName,
      image: options.image,
      port: options.port,
      containerEnv: options.containerEnv,
      mountDockerSocket: options.mountDockerSocket,
      portMappings: options.portMappings,
      volumes: options.volumes,
      env: options.env,
    });
  const commands = startCommand
    ? [commandFromStringOrConfig(startCommand, 'floci.start', 'Start the Floci local cloud emulator', options.baseEnv)]
    : [];

  if (options.customerApiStartCommand) {
    commands.push(commandFromStringOrConfig(
      options.customerApiStartCommand,
      'customer-api.start',
      'Start the customer API that talks to the local cloud emulator',
      options.baseEnv,
    ));
  }

  return commands;
}

export function createStopCommands(
  stopCommand: FlociEnvironmentOptions['stopCommand'],
  containerName: string,
  baseEnv?: Record<string, string | undefined>,
): EnvironmentCommandDefinition[] {
  if (stopCommand === false) {
    return [];
  }

  return [
    commandFromStringOrConfig(
      stopCommand ?? dockerStopCommand(containerName),
      'floci.stop',
      'Stop the Floci local cloud emulator',
      baseEnv,
    ),
  ];
}

export function createSeedCommands(
  seed: string | FlociSeedConfig | undefined,
  baseEnv?: Record<string, string | undefined>,
): EnvironmentCommandDefinition[] {
  return seed
    ? [commandFromStringOrConfig(seed, 'floci.seed', 'Seed the local cloud/customer environment', baseEnv)]
    : [];
}
