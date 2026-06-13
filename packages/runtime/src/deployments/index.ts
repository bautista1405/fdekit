import type {
  DeploymentDefinition,
  MigrationNote,
} from '@fdekit/core';

import {
  diffValues,
  snapshotAgents,
  snapshotArtifacts,
  snapshotConnectors,
  snapshotEvals,
  snapshotGovernance,
  snapshotProviders,
  stripUndefinedDeep,
} from './helpers/index.js';
import type {
  DeploymentDiff,
  DeploymentDiffChange,
  DeploymentSnapshot,
  SnapshotAgent,
  SnapshotArtifactStore,
  SnapshotConnector,
  SnapshotDeployment,
  SnapshotEval,
  SnapshotGovernance,
  SnapshotProvider,
  SnapshotTool,
} from './interfaces/index.js';
export { compileDeployment } from './compiler.js';
export { validateDeployment } from './validation.js';
export type {
  CompiledAgentPlan,
  CompiledArtifactStorePlan,
  CompiledArtifactPaths,
  CompiledConnectorPlan,
  CompiledDeploymentPlan,
  CompiledEnvRequirement,
  CompiledEvalPlan,
  CompiledHarnessPhasePlan,
  CompiledHarnessPlan,
  CompiledPlanReference,
  CompiledPolicyPlan,
  CompiledProviderPlan,
  CompiledProviderRuntimeResolution,
  CompiledToolPlan,
  CompileDeploymentOptions,
  DeploymentDiff,
  DeploymentDiffChange,
  DeploymentSnapshot,
  DeploymentValidationIssue,
  DeploymentValidationOptions,
  DeploymentValidationResult,
  DeploymentValidationSeverity,
  SnapshotAgent,
  SnapshotConnector,
  SnapshotDeployment,
  SnapshotEval,
  SnapshotGovernance,
  SnapshotProvider,
  SnapshotTool,
} from './interfaces/index.js';

export function createDeploymentSnapshot(
  deployment: DeploymentDefinition,
  createdAt = new Date().toISOString(),
): DeploymentSnapshot {
  return stripUndefinedDeep({
    schemaVersion: 1,
    createdAt,
    deployment: {
      name: deployment.name,
      version: deployment.version,
      recipe: deployment.recipe,
      environment: deployment.environment,
      providers: snapshotProviders(deployment),
      connectors: snapshotConnectors(deployment),
      agents: snapshotAgents(deployment),
      governance: snapshotGovernance(deployment),
      policies: (deployment.policies ?? []).map((policy) => policy.name).sort(),
      evals: snapshotEvals(deployment),
      workflow: deployment.workflow,
      outcomeMetrics: deployment.outcomeMetrics,
      dataLayers: deployment.dataLayers,
      rollout: deployment.rollout,
      harness: deployment.harness,
      artifacts: snapshotArtifacts(deployment),
      migrationNotes: deployment.migrationNotes ?? [],
      metadata: deployment.metadata,
    },
  }) as DeploymentSnapshot;
}

export function diffDeploymentSnapshots(
  from: DeploymentSnapshot,
  to: DeploymentSnapshot,
): DeploymentDiff {
  const changes: DeploymentDiffChange[] = [];

  diffValues(from.deployment, to.deployment, [], changes);

  return {
    fromName: from.deployment.name,
    toName: to.deployment.name,
    changes,
  };
}
