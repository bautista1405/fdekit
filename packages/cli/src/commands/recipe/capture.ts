import { promises as fs } from 'fs';
import * as path from 'path';
import {
  createArtifactStore,
  createDeploymentSnapshot,
  loadDeployment,
  readJsonArtifact,
  readJsonIfExists,
  readTextArtifact,
  requireConfigFile,
} from '@fdekit/runtime';
import type { CommandContext } from '../../context.js';
import { renderCapturedRecipeReadme, renderWorkflowDoc } from './docs.js';
import {
  copyDir,
  copyFile,
  exists,
  isDirectory,
} from './files.js';
import { stringRecord } from './package-json.js';
import type {
  CapturedRecipeManifest,
  ProjectPackageJson,
} from './types.js';
import {
  isValidRecipeName,
  stripEmptyManifestFields,
} from './validation.js';

export async function captureLocalRecipe(
  ctx: CommandContext,
  recipeName: string,
  force: boolean,
): Promise<void> {
  if (!isValidRecipeName(recipeName)) {
    console.error('Recipe names must use lowercase letters, numbers, dots, underscores, or dashes');
    process.exitCode = 1;
    return;
  }

  const configPath = await requireConfigFile(ctx.cwd);
  const projectDir = path.dirname(configPath);
  const deployment = await loadDeployment(configPath);
  const artifactStore = createArtifactStore({ deployment, projectDir });
  const capturedAt = new Date().toISOString();
  const recipeDir = path.join(projectDir, 'recipes', recipeName);

  if (!force && await exists(recipeDir)) {
    console.error(`Recipe already exists: ${recipeDir}; re-run with --force to replace it`);
    process.exitCode = 1;
    return;
  }

  if (force) {
    await fs.rm(recipeDir, { recursive: true, force: true });
  }

  await fs.mkdir(recipeDir, { recursive: true });
  await copyFile(path.join(projectDir, 'fde.config.ts'), path.join(recipeDir, 'fde.config.ts'), true);

  const installFiles = ['fde.config.ts'];
  const optionalFiles = ['workflow.md', '.env.example', 'mock-planner.mjs'];
  const optionalDirs = ['agents', 'evals', 'customer-api', 'sample-repo', 'sales-data', 'load-tests', 'rules'];

  for (const file of optionalFiles) {
    const source = path.join(projectDir, file);

    if (await exists(source)) {
      await copyFile(source, path.join(recipeDir, file), true);
      installFiles.push(file);
    } else if (file === 'workflow.md') {
      await fs.writeFile(path.join(recipeDir, file), renderWorkflowDoc(deployment), 'utf8');
      installFiles.push(file);
    }
  }

  for (const dir of optionalDirs) {
    const source = path.join(projectDir, dir);

    if (await isDirectory(source)) {
      await copyDir(source, path.join(recipeDir, dir), { overwrite: true });
      installFiles.push(dir);
    }
  }

  const evidenceDir = path.join(recipeDir, 'artifacts');
  await fs.mkdir(evidenceDir, { recursive: true });
  const snapshot = createDeploymentSnapshot(deployment, capturedAt);
  await fs.writeFile(path.join(evidenceDir, 'deployment-snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  const latestEval = await readJsonArtifact<unknown>(projectDir, 'evals', 'latest.json', artifactStore);
  const report = await readTextArtifact(projectDir, 'reports', 'deployment-report.md', artifactStore);
  const evidence: CapturedRecipeManifest['evidence'] = {
    deploymentSnapshot: 'artifacts/deployment-snapshot.json',
  };

  if (latestEval) {
    await fs.writeFile(path.join(evidenceDir, 'latest-eval.json'), `${JSON.stringify(latestEval, null, 2)}\n`, 'utf8');
    evidence.latestEval = 'artifacts/latest-eval.json';
  }

  if (report) {
    await fs.writeFile(path.join(evidenceDir, 'deployment-report.md'), report, 'utf8');
    evidence.deploymentReport = 'artifacts/deployment-report.md';
  }

  const packageJson = await readJsonIfExists<ProjectPackageJson>(path.join(projectDir, 'package.json'));
  const manifest: CapturedRecipeManifest = {
    schemaVersion: 1,
    name: recipeName,
    version: deployment.version ?? '0.1.0',
    capturedAt,
    sourceDeployment: deployment.name,
    sourceEnvironment: deployment.environment,
    workflow: deployment.workflow,
    outcomeMetrics: deployment.outcomeMetrics,
    dataLayers: deployment.dataLayers,
    rollout: deployment.rollout,
    harness: deployment.harness,
    install: {
      files: installFiles,
    },
    package: packageJson ? {
      scripts: stringRecord(packageJson.scripts),
      dependencies: stringRecord(packageJson.dependencies),
      devDependencies: stringRecord(packageJson.devDependencies),
    } : undefined,
    evidence,
  };

  await fs.writeFile(path.join(recipeDir, 'recipe.json'), `${JSON.stringify(stripEmptyManifestFields(manifest), null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(recipeDir, 'README.md'), renderCapturedRecipeReadme(manifest), 'utf8');

  console.log(`Captured recipe ${recipeName}`);
  console.log(`Recipe directory: ${recipeDir}`);
  console.log(`Install again with: fdekit recipe install recipes/${recipeName}`);
}
