import type {
  DeploymentEnvironmentDefinition,
  EnvironmentCommandDefinition,
  EnvironmentHealthCheckDefinition,
} from '@fdekit/core';
import type {
  FlociCloudProvider,
  FlociEnvironmentKind,
  FlociMountDockerSocket,
  FlociServiceName,
  FlociStorageMode,
} from '../types/index.js';
import type { FlociCommandConfig, FlociSeedConfig } from './commands.js';
import type { FlociCustomerApiConfig } from './customer.js';

export interface FlociEnvironmentConfig extends Record<string, unknown> {
  cloud: FlociCloudProvider;
  endpoint: string;
  baseUrl?: string;
  image: string;
  port: number;
  containerName: string;
  services: FlociServiceName[];
  endpointEnvName: string;
  hostname?: string;
  defaultRegion?: string;
  defaultAccountId?: string;
  projectId?: string;
  storageMode?: FlociStorageMode;
  persistentPath?: string;
  dockerNetwork?: string;
  mountDockerSocket?: boolean;
  portMappings: string[];
  volumes?: string[];
  customerApi?: {
    url: string;
    healthUrl?: string;
    serviceName: string;
    replicas: number;
  };
}

export interface FlociEnvironmentOptions {
  name?: string;
  description?: string;
  cloud?: FlociCloudProvider;
  endpoint?: string;
  baseUrl?: string;
  image?: string;
  port?: number;
  containerName?: string;
  hostname?: string;
  defaultRegion?: string;
  defaultAccountId?: string;
  projectId?: string;
  services?: FlociServiceName[];
  storageMode?: FlociStorageMode;
  persistentPath?: string;
  dockerNetwork?: string;
  mountDockerSocket?: FlociMountDockerSocket;
  portMappings?: string[];
  volumes?: string[];
  startCommand?: string | FlociCommandConfig | false;
  stopCommand?: string | FlociCommandConfig | false;
  seed?: string | FlociSeedConfig;
  customerApi?: FlociCustomerApiConfig;
  env?: Record<string, string | undefined>;
  healthChecks?: EnvironmentHealthCheckDefinition[];
  metadata?: Record<string, unknown>;
}

export type FlociEnvironmentDefinition = DeploymentEnvironmentDefinition<FlociEnvironmentConfig> & {
  kind: FlociEnvironmentKind;
  commands: {
    start: EnvironmentCommandDefinition[];
    stop: EnvironmentCommandDefinition[];
    seed?: EnvironmentCommandDefinition[];
  };
};
