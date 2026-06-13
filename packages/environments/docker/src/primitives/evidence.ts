import type {
  EnvironmentEndpointDefinition,
  EnvironmentHealthCheckDefinition,
  EnvironmentServiceDefinition,
} from '@fdekit/core';

export function createEndpoints(customerApiUrl: string | undefined): EnvironmentEndpointDefinition[] {
  return customerApiUrl
    ? [{
      name: 'customer-api',
      url: customerApiUrl,
      description: 'Customer API endpoint used by FDEKit connectors',
    }]
    : [];
}

export function createServices(options: {
  services: string[];
  customerApiUrl?: string;
  customerServiceName: string;
  customerReplicas: number;
  customerDescription?: string;
}): EnvironmentServiceDefinition[] {
  const services = options.services.map((service) => ({
    name: service,
    kind: service === options.customerServiceName ? 'customer-api' : 'docker-compose-service',
    endpoint: service === options.customerServiceName ? options.customerApiUrl : undefined,
    replicas: service === options.customerServiceName ? options.customerReplicas : undefined,
    description: service === options.customerServiceName
      ? options.customerDescription ?? 'Customer API service used by FDEKit'
      : undefined,
  }));

  if (options.customerApiUrl && !options.services.includes(options.customerServiceName)) {
    services.push({
      name: options.customerServiceName,
      kind: 'customer-api',
      endpoint: options.customerApiUrl,
      replicas: options.customerReplicas,
      description: options.customerDescription ?? 'Customer API service used by FDEKit',
    });
  }

  return services;
}

export function createHealthChecks(
  customerApiHealthUrl: string | undefined,
  extraChecks: EnvironmentHealthCheckDefinition[] = [],
): EnvironmentHealthCheckDefinition[] {
  return [
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
