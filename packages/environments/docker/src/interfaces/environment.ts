import type {
  DeploymentEnvironmentDefinition,
  EnvironmentCommandDefinition,
  EnvironmentHealthCheckDefinition,
} from '@fdekit/core';
import type { DockerComposeCommand, DockerEnvironmentKind, DockerServiceName } from '../types/index.js';
import type { DockerCommandConfig, DockerSeedConfig } from './commands.js';
import type { DockerCustomerApiConfig } from './customer.js';

export interface DockerEnvironmentConfig extends Record<string, unknown> {
  composeCommand: DockerComposeCommand;
  composeFile?: string;
  projectName?: string;
  envFile?: string;
  profiles: string[];
  services: DockerServiceName[];
  customerApi?: {
    url: string;
    healthUrl?: string;
    serviceName: string;
    replicas: number;
  };
}

export interface DockerEnvironmentOptions {
  name?: string;
  description?: string;
  composeCommand?: DockerComposeCommand;
  composeFile?: string;
  projectName?: string;
  envFile?: string;
  profiles?: string[];
  services?: DockerServiceName[];
  startCommand?: string | DockerCommandConfig | false;
  stopCommand?: string | DockerCommandConfig | false;
  seed?: string | DockerSeedConfig;
  customerApi?: DockerCustomerApiConfig;
  env?: Record<string, string | undefined>;
  healthChecks?: EnvironmentHealthCheckDefinition[];
  metadata?: Record<string, unknown>;
}

export type DockerEnvironmentDefinition = DeploymentEnvironmentDefinition<DockerEnvironmentConfig> & {
  kind: DockerEnvironmentKind;
  commands: {
    start: EnvironmentCommandDefinition[];
    stop: EnvironmentCommandDefinition[];
    seed?: EnvironmentCommandDefinition[];
  };
};
