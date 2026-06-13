import type { FlociCommandConfig } from './commands.js';

export interface FlociCustomerApiConfig {
  url: string;
  healthUrl?: string;
  serviceName?: string;
  startCommand?: string | FlociCommandConfig;
  replicas?: number;
  description?: string;
}
