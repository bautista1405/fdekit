import type { ArtifactStoreDefinition, DeploymentDefinition } from '@fdekit/core';

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

export interface S3ArtifactClient {
  putObject(input: S3PutObjectInput): Promise<unknown>;
  getObject(input: S3GetObjectInput): Promise<S3GetObjectOutput>;
  listObjectsV2(input: S3ListObjectsV2Input): Promise<S3ListObjectsV2Output>;
}

export interface S3PutObjectInput {
  Bucket: string;
  Key: string;
  Body: string | Uint8Array;
  ContentType?: string;
}

export interface S3GetObjectInput {
  Bucket: string;
  Key: string;
}

export interface S3GetObjectOutput {
  Body?: unknown;
}

export interface S3ListObjectsV2Input {
  Bucket: string;
  Prefix: string;
  ContinuationToken?: string;
}

export interface S3ListObjectsV2Output {
  Contents?: Array<{ Key?: string }>;
  IsTruncated?: boolean;
  NextContinuationToken?: string;
}
