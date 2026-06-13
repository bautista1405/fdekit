import { describe, expect, it } from 'vitest';
import { flociEnvironment } from '../index.js';

describe('flociEnvironment', () => {
  it('creates an AWS local cloud environment with sensible defaults', () => {
    const environment = flociEnvironment({
      services: ['sqs', 's3', 'sqs'],
      customerApi: {
        url: 'http://localhost:8787',
        healthUrl: 'http://localhost:8787/health',
        replicas: 3,
      },
      seed: 'npm run seed:floci',
    });

    expect(environment.kind).toBe('local-floci');
    expect(environment.name).toBe('floci-aws');
    expect(environment.config).toMatchObject({
      cloud: 'aws',
      endpoint: 'http://localhost:4566',
      image: 'floci/floci:latest',
      port: 4566,
      portMappings: ['4566:4566'],
      services: ['s3', 'sqs'],
      customerApi: {
        url: 'http://localhost:8787',
        healthUrl: 'http://localhost:8787/health',
        serviceName: 'customer-api',
        replicas: 3,
      },
    });
    expect(environment.commands.start[0]?.command).toContain('docker run -d');
    expect(environment.commands.start[0]?.command).toContain('-e FLOCI_PORT=4566');
    expect(environment.commands.start[0]?.env).toMatchObject({
      AWS_ENDPOINT_URL: 'http://localhost:4566',
      AWS_DEFAULT_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
    });
    expect(environment.commands.seed?.[0]?.command).toBe('npm run seed:floci');
    expect(environment.healthChecks.map((check) => check.name)).toEqual(['floci', 'customer-api']);
    expect(environment.healthChecks[0]?.url).toBe('http://localhost:4566/_localstack/health');
    expect(environment.evidence?.services?.find((service) => service.name === 'customer-api')?.replicas).toBe(3);
  });

  it('supports Azure/GCP images and custom start commands', () => {
    const environment = flociEnvironment({
      cloud: 'gcp',
      startCommand: {
        command: 'docker compose up -d floci',
        cwd: './infra/local',
      },
      stopCommand: false,
      endpoint: 'http://floci:4588/',
      hostname: 'floci',
    });

    expect(environment.config.cloud).toBe('gcp');
    expect(environment.config.image).toBe('floci/floci-gcp:latest');
    expect(environment.config.endpoint).toBe('http://floci:4588');
    expect(environment.config.baseUrl).toBe('http://floci:4588');
    expect(environment.config.hostname).toBe('floci');
    expect(environment.config.projectId).toBe('floci-local');
    expect(environment.commands.start[0]).toMatchObject({
      name: 'floci.start',
      command: 'docker compose up -d floci',
      cwd: './infra/local',
    });
    expect(environment.commands.start[0]?.env).toMatchObject({
      PUBSUB_EMULATOR_HOST: 'floci:4588',
      FIRESTORE_EMULATOR_HOST: 'floci:4588',
      STORAGE_EMULATOR_HOST: 'http://floci:4588',
      GOOGLE_CLOUD_PROJECT: 'floci-local',
    });
    expect(environment.healthChecks[0]?.url).toBe('http://floci:4588/_floci/health');
    expect(environment.commands.stop).toEqual([]);
  });

  it('maps Docker-backed service settings for AWS and Azure defaults', () => {
    const aws = flociEnvironment({
      services: ['lambda', 'rds'],
      dockerNetwork: 'customer_default',
      storageMode: 'hybrid',
      persistentPath: '/app/data',
    });
    const azure = flociEnvironment({
      cloud: 'azure',
      services: ['functions'],
      hostname: 'floci-az',
    });

    expect(aws.config.mountDockerSocket).toBe(true);
    expect(aws.config.portMappings).toEqual(['4566:4566', '9200-9299:9200-9299', '7001-7099:7001-7099']);
    expect(aws.commands.start[0]?.command).toContain('-v /var/run/docker.sock:/var/run/docker.sock');
    expect(aws.commands.start[0]?.command).toContain('-e FLOCI_SERVICES_DOCKER_NETWORK=customer_default');
    expect(aws.commands.start[0]?.command).toContain('-e FLOCI_STORAGE_MODE=hybrid');
    expect(aws.commands.start[0]?.command).toContain('-e FLOCI_STORAGE_PERSISTENT_PATH=/app/data');
    expect(azure.config.endpoint).toBe('http://localhost:4577');
    expect(azure.config.mountDockerSocket).toBe(true);
    expect(azure.commands.start[0]?.command).toContain('-e FLOCI_AZ_PORT=4577');
    expect(azure.commands.start[0]?.command).toContain('-e FLOCI_AZ_BASE_URL=http://floci-az:4577');
    expect(azure.commands.start[0]?.command).toContain('-e FLOCI_AZ_HOSTNAME=floci-az');
    expect(azure.commands.start[0]?.command).toContain('-e FLOCI_AZ_SERVICES_FUNCTIONS_ENABLED=true');
    expect(azure.commands.start[0]?.env?.AZURE_STORAGE_CONNECTION_STRING).toContain('BlobEndpoint=http://localhost:4577/devstoreaccount1');
  });

  it('builds Azure-specific config, command env, and health checks without AWS fields', () => {
    const environment = flociEnvironment({
      cloud: 'azure',
      hostname: 'floci-az',
      storageMode: 'persistent',
      persistentPath: '/var/lib/floci-az',
    });

    expect(environment.config).toMatchObject({
      cloud: 'azure',
      endpoint: 'http://localhost:4577',
      image: 'floci/floci-az:latest',
      port: 4577,
      containerName: 'fdekit-floci-azure',
      endpointEnvName: 'AZURE_ENDPOINT_URL',
      hostname: 'floci-az',
      storageMode: 'persistent',
      persistentPath: '/var/lib/floci-az',
    });
    expect(environment.config.defaultRegion).toBeUndefined();
    expect(environment.config.defaultAccountId).toBeUndefined();
    expect(environment.config.projectId).toBeUndefined();
    expect(environment.commands.start[0]?.command).toContain('--name fdekit-floci-azure');
    expect(environment.commands.start[0]?.command).toContain('floci/floci-az:latest');
    expect(environment.commands.start[0]?.command).toContain('-p 4577:4577');
    expect(environment.commands.start[0]?.command).toContain('-e FLOCI_AZ_PORT=4577');
    expect(environment.commands.start[0]?.command).toContain('-e FLOCI_AZ_BASE_URL=http://floci-az:4577');
    expect(environment.commands.start[0]?.command).toContain('-e FLOCI_AZ_HOSTNAME=floci-az');
    expect(environment.commands.start[0]?.command).toContain('-e FLOCI_AZ_STORAGE_MODE=persistent');
    expect(environment.commands.start[0]?.command).toContain('-e FLOCI_AZ_STORAGE_PATH=/var/lib/floci-az');
    expect(environment.commands.start[0]?.command).not.toContain('FLOCI_DEFAULT_REGION');
    expect(environment.commands.start[0]?.env).toMatchObject({
      AZURE_ENDPOINT_URL: 'http://localhost:4577',
      AZURE_BLOB_ENDPOINT: 'http://localhost:4577/devstoreaccount1',
      AZURE_QUEUE_ENDPOINT: 'http://localhost:4577/devstoreaccount1-queue',
      AZURE_TABLE_ENDPOINT: 'http://localhost:4577/devstoreaccount1-table',
      AZURE_COSMOS_NOSQL_TLS_ENDPOINT: 'https://localhost:4578/cosmos',
    });
    expect(environment.commands.start[0]?.env?.AZURE_STORAGE_CONNECTION_STRING).toContain('QueueEndpoint=http://localhost:4577/devstoreaccount1-queue');
    expect(environment.commands.start[0]?.env?.AWS_ENDPOINT_URL).toBeUndefined();
    expect(environment.healthChecks[0]?.url).toBe('http://localhost:4577/_floci/health');
  });

  it('builds GCP-specific config, command env, and emulator host variables', () => {
    const environment = flociEnvironment({
      cloud: 'gcp',
      hostname: 'floci-gcp',
      projectId: 'customer-demo',
      storageMode: 'wal',
      persistentPath: '/var/lib/floci-gcp',
    });

    expect(environment.config).toMatchObject({
      cloud: 'gcp',
      endpoint: 'http://localhost:4588',
      image: 'floci/floci-gcp:latest',
      port: 4588,
      containerName: 'fdekit-floci-gcp',
      endpointEnvName: 'GCP_ENDPOINT_URL',
      hostname: 'floci-gcp',
      projectId: 'customer-demo',
      storageMode: 'wal',
      persistentPath: '/var/lib/floci-gcp',
    });
    expect(environment.config.defaultRegion).toBeUndefined();
    expect(environment.config.defaultAccountId).toBeUndefined();
    expect(environment.commands.start[0]?.command).toContain('--name fdekit-floci-gcp');
    expect(environment.commands.start[0]?.command).toContain('floci/floci-gcp:latest');
    expect(environment.commands.start[0]?.command).toContain('-p 4588:4588');
    expect(environment.commands.start[0]?.command).toContain('-e FLOCI_GCP_PORT=4588');
    expect(environment.commands.start[0]?.command).toContain('-e FLOCI_GCP_BASE_URL=http://floci-gcp:4588');
    expect(environment.commands.start[0]?.command).toContain('-e FLOCI_GCP_HOSTNAME=floci-gcp');
    expect(environment.commands.start[0]?.command).toContain('-e FLOCI_GCP_STORAGE_MODE=wal');
    expect(environment.commands.start[0]?.command).toContain('-e FLOCI_GCP_STORAGE_PERSISTENT_PATH=/var/lib/floci-gcp');
    expect(environment.commands.start[0]?.command).toContain('-e FLOCI_GCP_DEFAULT_PROJECT_ID=customer-demo');
    expect(environment.commands.start[0]?.command).toContain('-e GOOGLE_CLOUD_PROJECT=customer-demo');
    expect(environment.commands.start[0]?.command).not.toContain('FLOCI_DEFAULT_ACCOUNT_ID');
    expect(environment.commands.start[0]?.env).toMatchObject({
      PUBSUB_EMULATOR_HOST: 'localhost:4588',
      FIRESTORE_EMULATOR_HOST: 'localhost:4588',
      DATASTORE_EMULATOR_HOST: 'localhost:4588',
      STORAGE_EMULATOR_HOST: 'http://localhost:4588',
      SECRET_MANAGER_EMULATOR_HOST: 'localhost:4588',
      GOOGLE_CLOUD_PROJECT: 'customer-demo',
    });
    expect(environment.commands.start[0]?.env?.AWS_ENDPOINT_URL).toBeUndefined();
    expect(environment.healthChecks[0]?.url).toBe('http://localhost:4588/_floci/health');
  });

  it('enables Azure Docker-backed services from service names', () => {
    const environment = flociEnvironment({
      cloud: 'azure',
      services: ['eventhub', 'cosmos-mongo', 'cosmos-postgres', 'cosmos-nosql'],
      volumes: ['./data:/app/data'],
      env: {
        FLOCI_AZ_SERVICES_COSMOS_ENGINES_POSTGRESQL_ENABLED: 'false',
      },
    });

    const startCommand = environment.commands.start[0]?.command ?? '';

    expect(environment.config.mountDockerSocket).toBe(true);
    expect(environment.config.volumes).toEqual(['./data:/app/data']);
    expect(environment.config.portMappings).toEqual([
      '4577:4577',
      '27017:27017',
      '4578:4578',
      '5432:5432',
      '5672:5672',
      '9093:9093',
    ]);
    expect(startCommand).toContain('-e FLOCI_AZ_SERVICES_COSMOS_ENABLED=true');
    expect(startCommand).toContain('-e FLOCI_AZ_SERVICES_COSMOS_ENGINES_MONGODB_ENABLED=true');
    expect(startCommand).toContain('-e FLOCI_AZ_SERVICES_COSMOS_ENGINES_NOSQL_ENABLED=true');
    expect(startCommand).toContain('-e FLOCI_AZ_SERVICES_COSMOS_ENGINES_POSTGRESQL_ENABLED=false');
    expect(startCommand).toContain('-v ./data:/app/data');
    expect(startCommand).toContain('-v /var/run/docker.sock:/var/run/docker.sock');
    expect(startCommand).toContain('-u root');
    expect(environment.commands.start[0]?.env).toMatchObject({
      AZURE_EVENTHUB_AMQP_ENDPOINT: 'amqp://localhost:5672',
      AZURE_EVENTHUB_KAFKA_BROKERS: 'localhost:9093',
      AZURE_COSMOS_MONGODB_ENDPOINT: 'mongodb://localhost:27017',
      AZURE_COSMOS_POSTGRESQL_ENDPOINT: 'postgres://localhost:5432',
      FLOCI_AZ_SERVICES_COSMOS_ENGINES_POSTGRESQL_ENABLED: 'false',
    });
  });

  it('maps GCP managed Kafka without adding native Azure ports', () => {
    const environment = flociEnvironment({
      cloud: 'gcp',
      services: ['kafka', 'pubsub'],
    });
    const startCommand = environment.commands.start[0]?.command ?? '';

    expect(environment.config.mountDockerSocket).toBe(true);
    expect(environment.config.portMappings).toEqual(['4588:4588']);
    expect(startCommand).toContain('-e FLOCI_GCP_SERVICES_KAFKA_ENABLED=true');
    expect(startCommand).toContain('-e FLOCI_GCP_SERVICES_PUBSUB_ENABLED=true');
    expect(startCommand).toContain('-v /var/run/docker.sock:/var/run/docker.sock');
    expect(startCommand).not.toContain('27017:27017');
    expect(environment.commands.start[0]?.env).toMatchObject({
      PUBSUB_EMULATOR_HOST: 'localhost:4588',
      GOOGLE_CLOUD_PROJECT: 'floci-local',
    });
  });
});
