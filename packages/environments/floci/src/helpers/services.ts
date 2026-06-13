import type { FlociCloudProvider, FlociServiceName } from '../types/index.js';
import {
  awsServicePortMappings,
  azureServicePortMappings,
  azureServiceEnvNames,
  dockerBackedServices,
  gcpServiceEnvNames,
} from './service-catalog.js';

export function uniqueServices(services: readonly FlociServiceName[] = []): FlociServiceName[] {
  return [...new Set(services.map((service) => service.trim()).filter(Boolean))].sort();
}

export function requiresDockerSocket(services: readonly FlociServiceName[]): boolean {
  return services.some((service) => dockerBackedServices.has(normalizeServiceName(service)));
}

export function resolveMountDockerSocket(
  requested: boolean | 'auto' | undefined,
  services: readonly FlociServiceName[],
): boolean {
  if (requested === undefined || requested === 'auto') {
    return requiresDockerSocket(services);
  }

  return requested;
}

export function defaultPortMappings(
  port: number,
  services: readonly FlociServiceName[],
  cloud?: FlociCloudProvider,
): string[] {
  return uniquePortMappings([
    `${port}:${port}`,
    ...services.flatMap((service) => servicePortMappings(service, cloud)),
  ]);
}

export function serviceContainerEnv(
  cloud: FlociCloudProvider,
  services: readonly FlociServiceName[],
): Record<string, string> {
  const envNames = uniqueValues(services.flatMap((service) => serviceEnvNames(cloud, service)));

  return Object.fromEntries(envNames.map((name) => [name, 'true']));
}

function servicePortMappings(service: string, cloud: FlociCloudProvider | undefined): string[] {
  const serviceName = normalizeServiceName(service);

  if (cloud === 'gcp') {
    return [];
  }

  if (cloud === 'azure') {
    return azureServicePortMappings[serviceName] ?? [];
  }

  return awsServicePortMappings[serviceName] ?? [];
}

function serviceEnvNames(cloud: FlociCloudProvider, service: string): string[] {
  const serviceName = normalizeServiceName(service);

  if (cloud === 'azure') {
    return azureServiceEnvNames[serviceName] ?? [];
  }

  if (cloud === 'gcp') {
    return gcpServiceEnvNames[serviceName] ?? [];
  }

  return [];
}

function uniquePortMappings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeServiceName(service: string): string {
  return service.trim().toLowerCase().replace(/_/g, '-');
}
