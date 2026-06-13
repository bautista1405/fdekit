import type { DeploymentDefinition } from '@fdekit/core';
import type { CompiledDeploymentPlan, CompileDeploymentOptions } from './interfaces/index.js';
import { compileAgents } from './compiler/agents.js';
import { compileArtifactPaths, compileArtifactStore } from './compiler/artifacts.js';
import { compileConnectors } from './compiler/connectors.js';
import { compileEnvRequirements } from './compiler/env.js';
import { compileEvals } from './compiler/evals.js';
import { compileHarness } from './compiler/harness.js';
import { compileProviders } from './compiler/providers.js';
import { collectKnownRefs } from './compiler/refs.js';
import { validateDeployment } from './validation.js';

export function compileDeployment(
  deployment: DeploymentDefinition,
  options: CompileDeploymentOptions = {},
): CompiledDeploymentPlan {
  const {
    createdAt = new Date().toISOString(),
    projectDir,
    providerRegistry = {},
    ...validationOptions
  } = options;
  const providers = compileProviders(deployment.providers ?? {}, providerRegistry);
  const connectors = compileConnectors(deployment.connectors ?? {});
  const evals = compileEvals(deployment);
  const knownRefs = collectKnownRefs(deployment, connectors, evals);
  const issues = [...validateDeployment(deployment, validationOptions).issues];
  const agents = compileAgents(deployment, providers, connectors, evals, knownRefs, providerRegistry, issues);
  const validation = {
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };

  return {
    schemaVersion: 1,
    createdAt,
    projectDir,
    valid: validation.valid,
    validation,
    deployment: {
      name: deployment.name,
      version: deployment.version,
      recipe: deployment.recipe,
      environment: deployment.environment ?? 'local',
    },
    providers,
    connectors,
    agents,
    evals,
    harness: deployment.harness ? compileHarness(deployment.harness, knownRefs) : undefined,
    envRequirements: compileEnvRequirements(deployment),
    artifactStore: compileArtifactStore(deployment.artifacts, projectDir),
    artifactPaths: compileArtifactPaths(projectDir, deployment.artifacts),
  };
}
