export type DockerEnvironmentKind = 'local-docker';

export type DockerServiceName = string;

export type DockerComposeCommand = 'docker compose' | 'docker-compose' | (string & {});
