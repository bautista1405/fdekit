import { promises as fs } from 'fs';
import * as path from 'path';
import {
  readJsonIfExists,
} from '@fdekit/runtime';
import type { RecipeInstallResult } from '../../scaffolds/index.js';
import {
  copyDir,
  copyInstallAsset,
} from './files.js';
import { mergePackageJson } from './package-json.js';
import type {
  CapturedRecipeManifest,
  LocalRecipe,
} from './types.js';
import { isDefaultScaffoldConfig } from './validation.js';

export async function installCapturedRecipe(
  projectDir: string,
  source: LocalRecipe,
): Promise<RecipeInstallResult> {
  const recipeName = source.manifest.name;
  const configPath = path.join(projectDir, 'fde.config.ts');
  const targetRecipeDir = path.join(projectDir, 'recipes', recipeName);

  if (path.resolve(source.dir) !== path.resolve(targetRecipeDir)) {
    await copyDir(source.dir, targetRecipeDir, { overwrite: false });
  }

  for (const file of source.manifest.install.files.filter((item) => item !== 'fde.config.ts')) {
    await copyInstallAsset(source.dir, projectDir, file);
  }

  await mergePackageJson(projectDir, source.manifest);

  let configUpdated = false;
  let configSkipped = false;
  const recipeConfig = await fs.readFile(path.join(source.dir, 'fde.config.ts'), 'utf8');

  try {
    const existing = await fs.readFile(configPath, 'utf8');

    if (isDefaultScaffoldConfig(existing)) {
      await fs.writeFile(configPath, recipeConfig, 'utf8');
      configUpdated = true;
    } else {
      await fs.mkdir(targetRecipeDir, { recursive: true });
      await fs.writeFile(path.join(targetRecipeDir, 'fde.config.ts'), recipeConfig, 'utf8');
      configSkipped = true;
    }
  } catch {
    await fs.writeFile(configPath, recipeConfig, 'utf8');
    configUpdated = true;
  }

  return {
    projectDir,
    configPath,
    configUpdated,
    configSkipped,
  };
}

export async function resolveLocalRecipe(
  projectDir: string,
  recipeNameOrPath: string,
  invocationDir = projectDir,
): Promise<LocalRecipe | null> {
  const candidates = [
    path.isAbsolute(recipeNameOrPath)
      ? recipeNameOrPath
      : path.resolve(invocationDir, recipeNameOrPath),
    path.join(projectDir, 'recipes', recipeNameOrPath),
  ];

  for (const candidate of candidates) {
    const manifestPath = path.join(candidate, 'recipe.json');
    const manifest = await readJsonIfExists<CapturedRecipeManifest>(manifestPath);

    if (manifest?.schemaVersion === 1 && manifest.name) {
      return {
        dir: candidate,
        manifest,
      };
    }
  }

  return null;
}
