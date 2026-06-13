import { defineEnvironment, mergeEnv } from '@fdekit/core';
import { defaultDockerComposeCommand, defaultDockerComposeFile } from '../config/index.js';
import { uniqueServices } from '../helpers/index.js';
import type {
  DockerEnvironmentConfig,
  DockerEnvironmentDefinition,
  DockerEnvironmentOptions,
} from '../interfaces/index.js';
import { createStartCommands, createStopCommands, createSeedCommands } from './commands.js';
import { createEndpoints, createHealthChecks, createServices } from './evidence.js';

export function dockerEnvironment(options: DockerEnvironmentOptions = {}): DockerEnvironmentDefinition {
  const composeCommand = options.composeCommand ?? defaultDockerComposeCommand;
  const composeFile = options.composeFile ?? defaultDockerComposeFile;
  const profiles = uniqueServices(options.profiles);
  const services = uniqueServices(options.services);
  const customerServiceName = options.customerApi?.serviceName ?? 'customer-api';
  const customerReplicas = options.customerApi?.replicas ?? 1;
  const baseEnv = mergeEnv({
    CUSTOMER_API_URL: options.customerApi?.url,
  }, options.env);
  const config: DockerEnvironmentConfig = {
    composeCommand,
    composeFile,
    projectName: options.projectName,
    envFile: options.envFile,
    profiles,
    services,
    customerApi: options.customerApi
      ? {
        url: options.customerApi.url,
        healthUrl: options.customerApi.healthUrl,
        serviceName: customerServiceName,
        replicas: customerReplicas,
      }
      : undefined,
  };
  const start = createStartCommands(options, {
    composeCommand,
    composeFile,
    profiles,
    services,
    baseEnv,
  });
  const stop = createStopCommands(options, {
    composeCommand,
    composeFile,
    profiles,
    baseEnv,
  });
  const seed = createSeedCommands(options.seed, baseEnv);
  const endpoints = createEndpoints(options.customerApi?.url);
  const environmentServices = createServices({
    services,
    customerApiUrl: options.customerApi?.url,
    customerServiceName,
    customerReplicas,
    customerDescription: options.customerApi?.description,
  });
  const healthChecks = createHealthChecks(options.customerApi?.healthUrl, options.healthChecks);

  return defineEnvironment({
    name: options.name ?? 'docker-local',
    kind: 'local-docker',
    description: options.description ?? 'Local Docker Compose customer environment',
    config,
    commands: {
      start,
      stop,
      ...(seed.length > 0 ? { seed } : {}),
    },
    healthChecks,
    evidence: {
      kind: 'local-docker',
      name: options.name ?? 'docker-local',
      endpoints,
      services: environmentServices,
      metadata: {
        composeFile,
        projectName: options.projectName,
        services,
        profiles,
        customerApiUrl: options.customerApi?.url,
      },
    },
    metadata: options.metadata,
  }) as DockerEnvironmentDefinition;
}
