import type { FlociCloudDefaults, FlociCloudProvider } from '../types/index.js';
import { serviceContainerEnv } from '../helpers/services.js';

export function createContainerEnv(options: {
  cloud: FlociCloudProvider;
  endpoint: string;
  baseUrl?: string;
  port: number;
  hostname?: string;
  defaultRegion: string;
  defaultAccountId: string;
  projectId: string;
  storageMode?: string;
  persistentPath?: string;
  dockerNetwork?: string;
  defaults: FlociCloudDefaults;
  services: readonly string[];
}): Record<string, string | undefined> {
  return {
    [options.defaults.portEnvName]: String(options.port),
    [options.defaults.baseUrlEnvName]: options.baseUrl,
    [options.defaults.hostnameEnvName]: options.hostname,
    [options.defaults.storageModeEnvName]: options.storageMode,
    [options.defaults.storagePathEnvName]: options.persistentPath,
    ...(options.defaults.dockerNetworkEnvName && options.dockerNetwork
      ? { [options.defaults.dockerNetworkEnvName]: options.dockerNetwork }
      : {}),
    ...serviceContainerEnv(options.cloud, options.services),
    ...(options.cloud === 'aws'
      ? {
        FLOCI_DEFAULT_REGION: options.defaultRegion,
        FLOCI_DEFAULT_ACCOUNT_ID: options.defaultAccountId,
      }
      : {}),
    ...(options.cloud === 'gcp'
      ? {
        FLOCI_GCP_DEFAULT_PROJECT_ID: options.projectId,
        GOOGLE_CLOUD_PROJECT: options.projectId,
      }
      : {}),
  };
}

export function createSdkEnv(options: {
  cloud: FlociCloudProvider;
  endpoint: string;
  defaultRegion: string;
  projectId: string;
}): Record<string, string | undefined> {
  if (options.cloud === 'aws') {
    return {
      AWS_ENDPOINT_URL: options.endpoint,
      AWS_DEFAULT_REGION: options.defaultRegion,
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
    };
  }

  if (options.cloud === 'gcp') {
    const host = stripProtocol(options.endpoint);

    return {
      PUBSUB_EMULATOR_HOST: host,
      FIRESTORE_EMULATOR_HOST: host,
      DATASTORE_EMULATOR_HOST: host,
      STORAGE_EMULATOR_HOST: options.endpoint,
      SECRET_MANAGER_EMULATOR_HOST: host,
      GOOGLE_CLOUD_PROJECT: options.projectId,
    };
  }

  const accountName = 'devstoreaccount1';
  const accountKey = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMh0==';
  const endpointHost = hostFromEndpoint(options.endpoint);

  return {
    AZURE_ENDPOINT_URL: options.endpoint,
    AZURE_BLOB_ENDPOINT: `${options.endpoint}/${accountName}`,
    AZURE_QUEUE_ENDPOINT: `${options.endpoint}/${accountName}-queue`,
    AZURE_TABLE_ENDPOINT: `${options.endpoint}/${accountName}-table`,
    AZURE_FUNCTIONS_ENDPOINT: `${options.endpoint}/functions`,
    AZURE_APPCONFIG_ENDPOINT: `${options.endpoint}/.appconfig`,
    AZURE_KEYVAULT_ENDPOINT: `${options.endpoint}/.vault`,
    AZURE_EVENTHUB_AMQP_ENDPOINT: `amqp://${endpointHost}:5672`,
    AZURE_EVENTHUB_KAFKA_BROKERS: `${endpointHost}:9093`,
    AZURE_COSMOS_NOSQL_ENDPOINT: `${options.endpoint}/cosmos`,
    AZURE_COSMOS_NOSQL_TLS_ENDPOINT: `https://${endpointHost}:4578/cosmos`,
    AZURE_COSMOS_MONGODB_ENDPOINT: `mongodb://${endpointHost}:27017`,
    AZURE_COSMOS_POSTGRESQL_ENDPOINT: `postgres://${endpointHost}:5432`,
    AZURE_COSMOS_CASSANDRA_ENDPOINT: `${endpointHost}:9042`,
    AZURE_COSMOS_GREMLIN_ENDPOINT: `ws://${endpointHost}:8182`,
    AZURE_STORAGE_CONNECTION_STRING: [
      'DefaultEndpointsProtocol=http',
      `AccountName=${accountName}`,
      `AccountKey=${accountKey}`,
      `BlobEndpoint=${options.endpoint}/${accountName}`,
      `QueueEndpoint=${options.endpoint}/${accountName}-queue`,
      `TableEndpoint=${options.endpoint}/${accountName}-table`,
    ].join(';') + ';',
  };
}

function stripProtocol(value: string): string {
  return value.replace(/^https?:\/\//, '');
}

function hostFromEndpoint(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return stripProtocol(value).split(':')[0] ?? value;
  }
}
