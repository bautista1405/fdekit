import { defineEnvironment, mergeEnv } from '@fdekit/core';
import {
  defaultPortMappings,
  getFlociCloudDefaults,
  normalizeEndpoint,
  resolveMountDockerSocket,
  uniqueServices,
} from '../helpers/index.js';
import type {
  FlociEnvironmentConfig,
  FlociEnvironmentDefinition,
  FlociEnvironmentOptions,
} from '../interfaces/index.js';
import { createStartCommands, createStopCommands, createSeedCommands } from './commands.js';
import { createContainerEnv, createSdkEnv } from './env.js';
import { createEndpoints, createHealthChecks, createServices } from './evidence.js';

export function flociEnvironment(options: FlociEnvironmentOptions = {}): FlociEnvironmentDefinition {
  const cloud = options.cloud ?? 'aws';
  const defaults = getFlociCloudDefaults(cloud);
  const endpoint = normalizeEndpoint(options.endpoint ?? defaults.endpoint);
  const image = options.image ?? defaults.image;
  const port = options.port ?? defaults.port;
  const baseUrl = options.baseUrl ?? (options.hostname ? `http://${options.hostname}:${port}` : undefined);
  const containerName = options.containerName ?? defaults.containerName;
  const services = uniqueServices(options.services);
  const defaultRegion = options.defaultRegion ?? 'us-east-1';
  const defaultAccountId = options.defaultAccountId ?? '000000000000';
  const projectId = options.projectId ?? 'floci-local';
  const mountDockerSocket = resolveMountDockerSocket(options.mountDockerSocket, services);
  const portMappings = options.portMappings ?? defaultPortMappings(port, services, cloud);
  const containerEnv = createContainerEnv({
    cloud,
    endpoint,
    baseUrl,
    port,
    hostname: options.hostname,
    defaultRegion,
    defaultAccountId,
    projectId,
    storageMode: options.storageMode,
    persistentPath: options.persistentPath,
    dockerNetwork: options.dockerNetwork,
    defaults,
    services,
  });
  const baseEnv = mergeEnv(createSdkEnv({
    cloud,
    endpoint,
    defaultRegion,
    projectId,
  }), options.env);
  const customerServiceName = options.customerApi?.serviceName ?? 'customer-api';
  const customerReplicas = options.customerApi?.replicas ?? 1;
  const config: FlociEnvironmentConfig = {
    cloud,
    endpoint,
    baseUrl,
    image,
    port,
    containerName,
    services,
    endpointEnvName: defaults.endpointEnvName,
    hostname: options.hostname,
    defaultRegion: cloud === 'aws' ? defaultRegion : undefined,
    defaultAccountId: cloud === 'aws' ? defaultAccountId : undefined,
    projectId: cloud === 'gcp' ? projectId : undefined,
    storageMode: options.storageMode,
    persistentPath: options.persistentPath,
    dockerNetwork: options.dockerNetwork,
    mountDockerSocket,
    portMappings,
    volumes: options.volumes,
    customerApi: options.customerApi
      ? {
        url: options.customerApi.url,
        healthUrl: options.customerApi.healthUrl,
        serviceName: customerServiceName,
        replicas: customerReplicas,
      }
      : undefined,
  };
  const start = createStartCommands({
    startCommand: options.startCommand,
    containerName,
    image,
    port,
    containerEnv,
    mountDockerSocket,
    portMappings: options.portMappings ?? portMappings,
    volumes: options.volumes,
    env: options.env,
    customerApiStartCommand: options.customerApi?.startCommand,
    baseEnv,
  });
  const stop = createStopCommands(options.stopCommand, containerName, baseEnv);
  const seed = createSeedCommands(options.seed, baseEnv);
  const endpoints = createEndpoints(endpoint, options.customerApi?.url);
  const environmentServices = createServices({
    cloud,
    endpoint,
    services,
    customerApiUrl: options.customerApi?.url,
    customerServiceName,
    customerReplicas,
    customerDescription: options.customerApi?.description,
  });
  const healthChecks = createHealthChecks(cloud, endpoint, options.customerApi?.healthUrl, options.healthChecks);

  return defineEnvironment({
    name: options.name ?? `floci-${cloud}`,
    kind: 'local-floci',
    description: options.description ?? `Local ${cloud.toUpperCase()} cloud emulator powered by Floci`,
    config,
    commands: {
      start,
      stop,
      ...(seed.length > 0 ? { seed } : {}),
    },
    healthChecks,
    evidence: {
      kind: 'local-floci',
      name: options.name ?? `floci-${cloud}`,
      endpoints,
      services: environmentServices,
      metadata: {
        cloud,
        services,
        customerApiUrl: options.customerApi?.url,
        flociEndpoint: endpoint,
        flociBaseUrl: baseUrl,
        dockerNetwork: options.dockerNetwork,
        mountDockerSocket,
      },
    },
    metadata: options.metadata,
  }) as FlociEnvironmentDefinition;
}
