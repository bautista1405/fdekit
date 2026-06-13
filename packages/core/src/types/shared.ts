export type MaybePromise<T> = T | Promise<T>;

export type ProviderName = 'openai' | 'anthropic' | 'google' | (string & {});
export type ConnectorName = 'github' | 'slack' | 'postgres' | 'mcp' | 'hubspot' | 'salesforce' | (string & {});
export type EnvironmentName = 'local' | 'development' | 'staging' | 'production' | (string & {});

export interface EnvironmentVariableRequirement {
  name: string;
  required?: boolean;
  description?: string;
}
