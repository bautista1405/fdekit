import { flociCloudDefaults } from '../config/index.js';
import type { FlociCloudDefaults, FlociCloudProvider } from '../types/index.js';

export function getFlociCloudDefaults(cloud: FlociCloudProvider): FlociCloudDefaults {
  return flociCloudDefaults[cloud];
}

export function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, '');
}
