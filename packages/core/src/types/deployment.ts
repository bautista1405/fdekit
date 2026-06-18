import type { AgentConfig } from './agent.js';
import type { ConnectorDefinition } from './connector.js';
import type { DeploymentEnvironmentDefinition } from './environment.js';
import type { EvalDefinition } from './eval.js';
import type { GovernanceDefinition } from './governance.js';
import type { HarnessDefinition } from './harness.js';
import type { PolicyDefinition } from './policy.js';
import type { ProviderConfig } from './provider.js';
import type { EnvironmentName } from './shared.js';
import type {
  DataLayersDefinition,
  OutcomeMetricDefinition,
  RolloutDefinition,
  WorkflowDefinition,
} from './workflow.js';

export type ArtifactStoreDefinition =
  | LocalArtifactStoreDefinition
  | S3ArtifactStoreDefinition;

export interface LocalArtifactStoreDefinition {
  kind?: 'local';
  rootDir?: string;
}

export interface S3ArtifactStoreDefinition {
  kind: 's3';
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

export interface DeploymentDefinition {
  name: string;
  version?: string;
  recipe?: RecipeReference;
  environment?: EnvironmentName;
  runtimeEnvironment?: DeploymentEnvironmentDefinition;
  localEnvironment?: DeploymentEnvironmentDefinition;
  providers: Record<string, ProviderConfig>;
  connectors?: Record<string, ConnectorDefinition>;
  agents: Record<string, AgentConfig>;
  governance?: GovernanceDefinition;
  policies?: PolicyDefinition[];
  evals?: EvalDefinition[];
  workflow?: WorkflowDefinition;
  outcomeMetrics?: OutcomeMetricDefinition[];
  dataLayers?: DataLayersDefinition;
  rollout?: RolloutDefinition;
  harness?: HarnessDefinition;
  artifacts?: ArtifactStoreDefinition;
  migrationNotes?: MigrationNote[];
  metadata?: Record<string, unknown>;
}

export interface RecipeReference {
  name: string;
  version?: string;
}

export interface MigrationNote {
  from?: string;
  to?: string;
  summary: string;
  breaking?: boolean;
  steps?: string[];
}

export interface RecipeDefinition {
  name: string;
  version?: string;
  description?: string;
  compatibility?: {
    fdekit?: string;
  };
  providers?: Record<string, ProviderConfig>;
  connectors?: Record<string, ConnectorDefinition>;
  agents?: Record<string, AgentConfig>;
  policies?: PolicyDefinition[];
  evals?: EvalDefinition[];
  workflow?: WorkflowDefinition;
  outcomeMetrics?: OutcomeMetricDefinition[];
  dataLayers?: DataLayersDefinition;
  rollout?: RolloutDefinition;
  harness?: HarnessDefinition;
  migrations?: MigrationNote[];
  files?: Array<{ path: string; contents: string }>;
  metadata?: Record<string, unknown>;
}
