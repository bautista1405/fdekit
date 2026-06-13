import type {
  EnvironmentEndpointDefinition,
  EnvironmentHealthCheckDefinition,
  EnvironmentServiceDefinition,
} from '@fdekit/core';
import type { FlociCloudProvider } from '../types/index.js';

export function createEndpoints(flociEndpoint: string, customerApiUrl: string | undefined): EnvironmentEndpointDefinition[] {
  return [
    {
      name: 'floci',
      url: flociEndpoint,
      description: 'Local cloud emulator endpoint',
    },
    ...(customerApiUrl
      ? [{
        name: 'customer-api',
        url: customerApiUrl,
        description: 'Customer API endpoint used by FDEKit connectors',
      }]
      : []),
  ];
}

export function createServices(options: {
  cloud: string;
  endpoint: string;
  services: string[];
  customerApiUrl?: string;
  customerServiceName: string;
  customerReplicas: number;
  customerDescription?: string;
}): EnvironmentServiceDefinition[] {
  return [
    {
      name: 'floci',
      kind: `${options.cloud}-emulator`,
      endpoint: options.endpoint,
      description: 'Floci local cloud emulator',
      metadata: {
        services: options.services,
      },
    },
    ...(options.customerApiUrl
      ? [{
        name: options.customerServiceName,
        kind: 'customer-api',
        endpoint: options.customerApiUrl,
        replicas: options.customerReplicas,
        description: options.customerDescription ?? 'Customer API service that talks to Floci',
      }]
      : []),
  ];
}

export function createHealthChecks(
  cloud: FlociCloudProvider,
  endpoint: string,
  customerApiHealthUrl: string | undefined,
  extraChecks: EnvironmentHealthCheckDefinition[] = [],
): EnvironmentHealthCheckDefinition[] {
  const healthPath = cloud === 'aws' ? '/_localstack/health' : '/_floci/health';

  return [
    {
      name: 'floci',
      url: `${endpoint}${healthPath}`,
      expectedStatus: 200,
      timeoutMs: 2000,
      optional: true,
      description: 'Floci health endpoint',
    },
    ...(customerApiHealthUrl
      ? [{
        name: 'customer-api',
        url: customerApiHealthUrl,
        expectedStatus: 200,
        timeoutMs: 2000,
        description: 'Customer API health endpoint',
      }]
      : []),
    ...extraChecks,
  ];
}
