export type FlociCloudProvider = 'aws' | 'azure' | 'gcp';

export type FlociEnvironmentKind = 'local-floci';

export type FlociStorageMode = 'memory' | 'persistent' | 'hybrid' | 'wal';

export type FlociMountDockerSocket = boolean | 'auto';

export type FlociServiceName = string;

export interface FlociCloudDefaults {
  cloud: FlociCloudProvider;
  image: string;
  port: number;
  endpoint: string;
  containerName: string;
  endpointEnvName: string;
  portEnvName: string;
  baseUrlEnvName: string;
  hostnameEnvName: string;
  storageModeEnvName: string;
  storagePathEnvName: string;
  dockerNetworkEnvName?: string;
}
