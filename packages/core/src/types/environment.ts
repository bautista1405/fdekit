export type DeploymentEnvironmentKind = 'local-process' | 'local-docker' | 'local-floci' | 'prod-api-cloud' | (string & {});

export interface EnvironmentCommandDefinition {
  name: string;
  command: string;
  description?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  optional?: boolean;
}

export interface EnvironmentHealthCheckDefinition {
  name: string;
  description?: string;
  url?: string;
  command?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  expectedStatus?: number;
  timeoutMs?: number;
  optional?: boolean;
}

export interface EnvironmentCheckResult {
  name: string;
  ok: boolean;
  latencyMs?: number;
  message?: string;
  url?: string;
  command?: string;
  optional?: boolean;
}

export interface EnvironmentEndpointDefinition {
  name: string;
  url: string;
  description?: string;
}

/**
 * Reference to an endpoint exported by the deployment's runtime environment.
 * Create with `environmentEndpoint(name)`; connectors resolve it at tool-call
 * time from `ToolCallContext.runtimeEnvironment`.
 */
export interface EnvironmentEndpointRef {
  $environmentEndpoint: string;
}

export interface EnvironmentServiceDefinition {
  name: string;
  kind?: string;
  replicas?: number;
  endpoint?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface EnvironmentEvidence {
  kind: DeploymentEnvironmentKind;
  name: string;
  endpoints?: EnvironmentEndpointDefinition[];
  services?: EnvironmentServiceDefinition[];
  metadata?: Record<string, unknown>;
}

export interface DeploymentEnvironmentDefinition<Config = Record<string, unknown>> {
  name: string;
  kind: DeploymentEnvironmentKind;
  description?: string;
  config?: Config;
  commands?: {
    start?: EnvironmentCommandDefinition[];
    stop?: EnvironmentCommandDefinition[];
    seed?: EnvironmentCommandDefinition[];
  };
  healthChecks?: EnvironmentHealthCheckDefinition[];
  evidence?: EnvironmentEvidence;
  metadata?: Record<string, unknown>;
}
