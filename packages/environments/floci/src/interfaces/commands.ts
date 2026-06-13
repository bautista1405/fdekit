export interface FlociCommandConfig {
  command: string;
  name?: string;
  description?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  optional?: boolean;
}

export interface FlociSeedConfig {
  command: string;
  name?: string;
  description?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  optional?: boolean;
}
