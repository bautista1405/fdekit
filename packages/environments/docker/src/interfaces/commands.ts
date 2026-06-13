export interface DockerCommandConfig {
  command: string;
  name?: string;
  description?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  optional?: boolean;
}

export interface DockerSeedConfig {
  command: string;
  name?: string;
  description?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  optional?: boolean;
}
