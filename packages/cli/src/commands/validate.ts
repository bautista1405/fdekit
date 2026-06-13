import * as path from 'path';
import {
  compileDeployment,
  createArtifactStore,
  createDeploymentSnapshot,
  loadDeployment,
  requireConfigFile,
  writeJsonArtifact,
} from '@fdekit/runtime';
import type { MigrationNote } from '@fdekit/core';
import type { CommandContext } from '../context.js';
import { builtinProviderRegistry } from '../providers/registry.js';

export async function cmdValidate(ctx: CommandContext): Promise<void> {
  const json = ctx.args.includes('--json');
  const strict = ctx.args.includes('--strict');
  const configPath = await requireConfigFile(ctx.cwd);
  const projectDir = path.dirname(configPath);
  const deployment = await loadDeployment(configPath);
  const artifactStore = createArtifactStore({ deployment, projectDir });
  const plan = compileDeployment(deployment, {
    projectDir,
    strict,
    providerRegistry: builtinProviderRegistry,
  });
  const result = plan.validation;
  const snapshot = createDeploymentSnapshot(deployment);
  const latestPath = await writeJsonArtifact(projectDir, 'deployments', 'latest.json', snapshot, artifactStore);
  const snapshotPath = await writeJsonArtifact(
    projectDir,
    'deployments/snapshots',
    `deployment-${safeTimestamp(snapshot.createdAt)}.json`,
    snapshot,
    artifactStore,
  );
  const planPath = await writeJsonArtifact(projectDir, 'deployments', 'execution-plan.json', plan, artifactStore);

  if (json) {
    console.log(JSON.stringify({
      valid: result.valid,
      issues: result.issues,
      snapshot: latestPath,
      snapshotCopy: snapshotPath,
      executionPlan: planPath,
      migrationNotes: deployment.migrationNotes ?? [],
      strict,
    }, null, 2));
  } else {
    console.log('FDEKit validate');
    console.log(`Deployment: ${deployment.name}`);

    if (deployment.version) {
      console.log(`Version: ${deployment.version}`);
    }

    if (deployment.recipe) {
      console.log(`Recipe: ${deployment.recipe.name}${deployment.recipe.version ? `@${deployment.recipe.version}` : ''}`);
    }

    console.log(`Config: ${path.relative(ctx.cwd, configPath) || path.basename(configPath)}`);
    console.log(`Mode: ${strict ? 'strict' : 'standard'}`);
    console.log(`Snapshot: ${latestPath}`);
    console.log(`Snapshot copy: ${snapshotPath}`);
    console.log(`Execution plan: ${planPath}`);
    console.log('');

    if (result.issues.length === 0) {
      console.log('No validation issues found');
    } else {
      for (const issue of result.issues) {
        console.log(`${issue.severity.toUpperCase()} ${issue.path}: ${issue.message}`);
      }
    }

    printMigrationNotes(deployment.migrationNotes ?? []);

    console.log('');
    console.log(result.valid ? 'Summary: deployment config is valid' : 'Summary: deployment config has validation errors');
  }

  if (!result.valid) {
    process.exitCode = 1;
  }
}

function printMigrationNotes(notes: MigrationNote[]): void {
  if (notes.length === 0) {
    return;
  }

  console.log('');
  console.log('Migration notes');

  for (const note of notes) {
    const versionRange = note.from || note.to
      ? ` ${note.from ?? '*'} -> ${note.to ?? '*'}`
      : '';
    const breaking = note.breaking ? ' [breaking]' : '';
    console.log(`- ${note.summary}${versionRange}${breaking}`);

    for (const step of note.steps ?? []) {
      console.log(`  - ${step}`);
    }
  }
}

function safeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}
