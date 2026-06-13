import type {
  DataLayersDefinition,
  HarnessDefinition,
  MigrationNote,
  OutcomeMetricDefinition,
  ProviderRuntimeRegistry,
  RolloutDefinition,
  WorkflowDefinition,
} from '@fdekit/core';

export type DeploymentValidationSeverity = 'error' | 'warning';

export interface DeploymentValidationIssue {
  severity: DeploymentValidationSeverity;
  path: string;
  message: string;
}

export interface DeploymentValidationResult {
  valid: boolean;
  issues: DeploymentValidationIssue[];
}

export interface DeploymentValidationOptions {
  strict?: boolean;
  requireToolArgsSchema?: boolean;
}

export interface DeploymentSnapshot {
  schemaVersion: 1;
  createdAt: string;
  deployment: SnapshotDeployment;
}

export interface SnapshotDeployment {
  name: string;
  version?: string;
  recipe?: {
    name: string;
    version?: string;
  };
  environment?: string;
  providers: Record<string, SnapshotProvider>;
  connectors: Record<string, SnapshotConnector>;
  agents: Record<string, SnapshotAgent>;
  governance?: SnapshotGovernance;
  policies: string[];
  evals: Record<string, SnapshotEval>;
  workflow?: WorkflowDefinition;
  outcomeMetrics?: OutcomeMetricDefinition[];
  dataLayers?: DataLayersDefinition;
  rollout?: RolloutDefinition;
  harness?: HarnessDefinition;
  artifacts?: SnapshotArtifactStore;
  migrationNotes: MigrationNote[];
  metadata?: Record<string, unknown>;
}

export interface SnapshotProvider {
  name: string;
  model?: string;
  apiKeyEnv?: string;
  env: string[];
  options: Record<string, unknown>;
}

export interface SnapshotConnector {
  name: string;
  env: string[];
  tools: Record<string, SnapshotTool>;
}

export interface SnapshotTool {
  description?: string;
  category?: string;
  tags: string[];
  scopes: string[];
  environments: string[];
  hasArgsSchema: boolean;
}

export interface SnapshotAgent {
  provider: string;
  model?: string;
  instructions: string;
  tools: string[];
  policies: string[];
  evals: string[];
  harness?: HarnessDefinition;
}

export interface SnapshotGovernance {
  auditEnabled?: boolean;
  allowedEnvironments: string[];
  deniedEnvironments: string[];
  environmentTools: string[];
  budgetCaps: Array<{
    scope?: string;
    maxUsd: number;
  }>;
  allowedScopes: string[];
  deniedScopes: string[];
  requireScopes?: boolean;
  denyPII?: boolean;
  redactSecrets?: boolean;
}

export type SnapshotArtifactStore =
  | SnapshotLocalArtifactStore
  | SnapshotS3ArtifactStore;

export interface SnapshotLocalArtifactStore {
  kind: 'local';
  rootDir?: string;
}

export interface SnapshotS3ArtifactStore {
  kind: 's3';
  bucket: string;
  prefix?: string;
  region?: string;
}

export interface SnapshotEval {
  version?: string;
  agent?: string;
  dataset?: string;
  maxSteps?: number;
  cases: string[];
  assertions: string[];
}

export interface DeploymentDiff {
  fromName?: string;
  toName?: string;
  changes: DeploymentDiffChange[];
}

export interface DeploymentDiffChange {
  kind: 'added' | 'removed' | 'changed';
  path: string;
  before?: unknown;
  after?: unknown;
}

export interface CompileDeploymentOptions extends DeploymentValidationOptions {
  createdAt?: string;
  projectDir?: string;
  providerRegistry?: ProviderRuntimeRegistry;
}

export interface CompiledDeploymentPlan {
  schemaVersion: 1;
  createdAt: string;
  projectDir?: string;
  valid: boolean;
  validation: DeploymentValidationResult;
  deployment: {
    name: string;
    version?: string;
    recipe?: {
      name: string;
      version?: string;
    };
    environment: string;
  };
  providers: Record<string, CompiledProviderPlan>;
  connectors: Record<string, CompiledConnectorPlan>;
  agents: Record<string, CompiledAgentPlan>;
  evals: Record<string, CompiledEvalPlan>;
  harness?: CompiledHarnessPlan;
  envRequirements: CompiledEnvRequirement[];
  artifactStore: CompiledArtifactStorePlan;
  artifactPaths: CompiledArtifactPaths;
}

export type CompiledProviderRuntimeResolution =
  | 'config-runtime'
  | 'registry'
  | 'mock-fallback'
  | 'missing'
  | 'not-configured';

export interface CompiledProviderPlan {
  key: string;
  name: string;
  model?: string;
  apiKeyEnv?: string;
  env: string[];
  optionKeys: string[];
  runtime: {
    source: CompiledProviderRuntimeResolution;
    registryKey?: string;
  };
}

export interface CompiledConnectorPlan {
  key: string;
  name: string;
  env: string[];
  configKeys: string[];
  tools: CompiledToolPlan[];
}

export interface CompiledToolPlan {
  name: string;
  source: 'connector' | 'agent';
  owner: string;
  description?: string;
  category?: string;
  tags: string[];
  scopes: string[];
  environments: string[];
  hasArgsSchema: boolean;
}

export interface CompiledPolicyPlan {
  name: string;
  source: 'deployment-governance' | 'deployment' | 'agent-governance' | 'agent';
  owner: string;
}

export interface CompiledEvalPlan {
  name: string;
  scope: 'deployment' | `agent:${string}`;
  agent?: string;
  dataset?: string;
  caseCount: number;
  assertionCount: number;
  hasCustomRunner: boolean;
  maxSteps?: number;
}

export interface CompiledAgentPlan {
  name: string;
  instructions: string;
  provider: {
    key: string;
    name: string;
    model?: string;
    runtime: CompiledProviderPlan['runtime'];
  };
  maxSteps?: number;
  tools: CompiledToolPlan[];
  policies: CompiledPolicyPlan[];
  evals: string[];
  harness?: CompiledHarnessPlan;
}

export interface CompiledHarnessPlan {
  name: string;
  version?: string;
  description?: string;
  maxSteps?: number;
  toolRefs: CompiledPlanReference[];
  policyRefs: CompiledPlanReference[];
  evalRefs: CompiledPlanReference[];
  artifactRefs: string[];
  phases: CompiledHarnessPhasePlan[];
  review?: {
    evalRefs: CompiledPlanReference[];
    artifactRefs: string[];
    adversarial?: boolean;
  };
  steer?: {
    enabled?: boolean;
    maxAttempts?: number;
    triggerRefs: CompiledPlanReference[];
  };
}

export interface CompiledHarnessPhasePlan {
  name: string;
  description?: string;
  maxSteps?: number;
  humanOwner?: string;
  toolRefs: CompiledPlanReference[];
  optionalToolRefs: CompiledPlanReference[];
  policyRefs: CompiledPlanReference[];
  evalRefs: CompiledPlanReference[];
  artifactRefs: string[];
}

export interface CompiledPlanReference {
  name: string;
  status: 'resolved' | 'missing';
  source?: string;
}

export interface CompiledEnvRequirement {
  name: string;
  required: boolean;
  description?: string;
  sources: string[];
}

export interface CompiledArtifactStorePlan {
  kind: 'local' | 's3';
  root: string;
  bucket?: string;
  prefix?: string;
  region?: string;
}

export interface CompiledArtifactPaths {
  root: string;
  traces: string;
  approvals: string;
  auditLog: string;
  deploymentsLatest: string;
  deploymentSnapshots: string;
  executionPlan: string;
  evalsLatest: string;
  macroEvalsLatest: string;
  macroEvalReport: string;
  feedbackEvalCandidates: string;
  feedbackEvalCases: string;
  report: string;
  console: string;
  consoleHistory: string;
  exports: string;
}
