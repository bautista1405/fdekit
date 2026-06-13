import type { AnyToolDefinition } from './tool.js';
import type { ConnectorName, EnvironmentVariableRequirement } from './shared.js';

export interface ConnectorDefinition<Config = Record<string, unknown>> {
  name: ConnectorName;
  description?: string;
  config?: Config;
  env?: EnvironmentVariableRequirement[];
  tools?: AnyToolDefinition[];
}
