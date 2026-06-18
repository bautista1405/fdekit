import type {
  ArtifactStoreDefinition,
  DeploymentDefinition,
  S3ArtifactClient,
} from '@fdekit/core';
export type {
  S3ArtifactClient,
  S3GetObjectInput,
  S3GetObjectOutput,
  S3ListObjectsV2Input,
  S3ListObjectsV2Output,
  S3PutObjectInput,
} from '@fdekit/core';

export type ArtifactStoreKind = 'local' | 's3';

export interface ArtifactRef {
  group: string;
  fileName: string;
}

export interface ArtifactStore {
  kind: ArtifactStoreKind;
  rootUri: string;
  uri(ref: ArtifactRef): string;
  writeJson(ref: ArtifactRef, value: unknown): Promise<string>;
  readJson<T = unknown>(ref: ArtifactRef): Promise<T | null>;
  listJson<T = unknown>(group: string): Promise<T[]>;
  writeText(ref: ArtifactRef, contents: string): Promise<string>;
  readText(ref: ArtifactRef): Promise<string | null>;
  appendJsonl(ref: ArtifactRef, value: unknown): Promise<string>;
  readJsonl<T = unknown>(ref: ArtifactRef): Promise<T[]>;
}

export interface CreateArtifactStoreOptions {
  deployment?: DeploymentDefinition;
  projectDir: string;
  store?: ArtifactStore;
}

export interface ArtifactStoreDefinitionOptions {
  definition: ArtifactStoreDefinition | undefined;
  projectDir: string;
}

export interface FileArtifactStoreOptions {
  projectDir: string;
  rootDir?: string;
}

export interface S3ArtifactStoreOptions {
  bucket: string;
  prefix?: string;
  region?: string;
  client: S3ArtifactClient;
}
