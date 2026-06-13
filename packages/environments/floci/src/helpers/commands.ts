import type { EnvironmentCommandDefinition } from '@fdekit/core';
import type { FlociCommandConfig } from '../interfaces/index.js';
import { mergeEnv, shellEscape } from '@fdekit/core';

export function commandFromStringOrConfig(
  value: string | FlociCommandConfig,
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

export function dockerStartCommand(options: {
  containerName: string;
  image: string;
  port: number;
  containerEnv?: Record<string, string | undefined>;
  mountDockerSocket?: boolean;
  portMappings?: string[];
  volumes?: string[];
  env?: Record<string, string | undefined>;
}): string {
  const envFlags = Object.entries({
    ...(options.containerEnv ?? {}),
    ...options.env,
  })
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `-e ${shellEscape(`${key}=${value}`)}`)
    .join(' ');
  const envPrefix = envFlags ? ` ${envFlags}` : '';
  const ports = uniqueValues(options.portMappings ?? [`${options.port}:${options.port}`])
    .map((mapping) => `-p ${shellEscape(mapping)}`)
    .join(' ');
  const volumeFlags = uniqueValues([
    ...(options.volumes ?? []),
    ...(options.mountDockerSocket ? ['/var/run/docker.sock:/var/run/docker.sock'] : []),
  ])
    .map((mapping) => `-v ${shellEscape(mapping)}`)
    .join(' ');
  const volumes = volumeFlags ? ` ${volumeFlags}` : '';
  const dockerUser = options.mountDockerSocket ? ' -u root' : '';

  return `docker run -d --name ${shellEscape(options.containerName)} ${ports}${envPrefix}${volumes}${dockerUser} ${shellEscape(options.image)}`;
}

export function dockerStopCommand(containerName: string): string {
  return `docker rm -f ${shellEscape(containerName)}`;
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
