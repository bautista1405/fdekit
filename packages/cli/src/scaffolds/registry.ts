import { promises as fs } from 'fs';
import * as path from 'path';
import { asRecord, escapeRegExp } from '@fdekit/core';
import { writeFileIfMissing } from '../utils/files.js';
import { isDefaultStarterConfig } from './starter.js';

export interface RecipeInstallResult {
  projectDir: string;
  configPath: string;
  configUpdated: boolean;
  configSkipped: boolean;
}

export interface RecipeContext {
  projectDir: string;
  projectName: string;
  recipeName: string;
  recipeDir: string;
  configPath: string;
}

export interface RecipeFile {
  path: string;
  contents: string;
  overwriteDefault?: (existing: string) => boolean;
}

export interface PackagePatch {
  type?: string;
  scripts?: Record<string, string>;
  scriptsIfMissing?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface EnvLine {
  name: string;
  value: string;
  description: string;
}

export interface Recipe {
  name: string;
  directories?: string[];
  files: (ctx: RecipeContext) => RecipeFile[];
  package?: (ctx: RecipeContext) => PackagePatch;
  env?: EnvLine[] | ((ctx: RecipeContext) => EnvLine[]);
  gitignore?: string;
  config: (ctx: RecipeContext) => string;
}

export interface BuiltinRecipe {
  name: string;
  install: (projectDir: string) => Promise<RecipeInstallResult>;
}

export function file(path: string, contents: string): RecipeFile {
  return { path, contents };
}

export function managedFile(
  path: string,
  contents: string,
  overwriteDefault: (existing: string) => boolean,
): RecipeFile {
  return { path, contents, overwriteDefault };
}

export function jsonFile(
  path: string,
  value: unknown,
  overwriteDefault?: (existing: string) => boolean,
): RecipeFile {
  return {
    path,
    contents: `${JSON.stringify(value, null, 2)}\n`,
    overwriteDefault,
  };
}

export function env(name: string, value: string, description: string): EnvLine {
  return { name, value, description };
}

export const baseScripts = {
  doctor: 'fdekit doctor',
  dev: 'fdekit dev',
  validate: 'fdekit validate',
  'validate:strict': 'fdekit validate --strict',
  diff: 'fdekit diff',
  eval: 'fdekit eval run',
  macro: 'fdekit eval macro',
  report: 'fdekit report',
} satisfies Record<string, string>;

export function providerEnv(): EnvLine[] {
  return [
    env('FDEKIT_PROVIDER', 'mock', 'Provider; use mock, localOllama, openai, anthropic, or google'),
    env('FDEKIT_MODEL', '', 'Optional model override; defaults are provider-specific'),
    env('OPENAI_API_KEY', '', 'OpenAI API key used when FDEKIT_PROVIDER=openai'),
    env('ANTHROPIC_API_KEY', '', 'Anthropic API key used when FDEKIT_PROVIDER=anthropic'),
    env('GEMINI_API_KEY', '', 'Google Gemini API key used when FDEKIT_PROVIDER=google'),
    env('OLLAMA_BASE_URL', '', 'Advanced Ollama URL override used when FDEKIT_PROVIDER=localOllama'),
  ];
}

export async function installRecipe(
  projectDir: string,
  recipe: Recipe,
): Promise<RecipeInstallResult> {
  const projectName = path.basename(projectDir);
  const recipeDir = path.join(projectDir, 'recipes', recipe.name);
  const configPath = path.join(projectDir, 'fde.config.ts');
  const ctx: RecipeContext = {
    projectDir,
    projectName,
    recipeName: recipe.name,
    recipeDir,
    configPath,
  };

  await createRecipeDirs(ctx, recipe.directories ?? []);
  await writeRecipeFiles(ctx, recipe.files(ctx));

  const packagePatch = recipe.package?.(ctx);

  if (packagePatch) {
    await upsertPackageJson(ctx, packagePatch);
  }

  const envEntries = typeof recipe.env === 'function'
    ? recipe.env(ctx)
    : recipe.env;

  if (envEntries?.length) {
    await upsertEnvExample(projectDir, envEntries);
  }

  if (recipe.gitignore) {
    await writeFileIfMissing(path.join(projectDir, '.gitignore'), recipe.gitignore);
  }

  const configTarget = await resolveRecipeConfigTarget(ctx);
  const configCtx = {
    ...ctx,
    configPath: configTarget.path,
  };

  await writeRecipeConfig(configTarget, recipe.config(configCtx));

  return {
    projectDir,
    configPath: configTarget.path,
    configUpdated: configTarget.kind === 'updated',
    configSkipped: configTarget.kind === 'skipped',
  };
}

async function createRecipeDirs(
  ctx: RecipeContext,
  directories: string[],
): Promise<void> {
  await Promise.all([
    ctx.recipeDir,
    ...directories.map((directory) => path.join(ctx.projectDir, directory)),
  ].map((directory) => fs.mkdir(directory, { recursive: true })));
}

async function writeRecipeFiles(
  ctx: RecipeContext,
  files: RecipeFile[],
): Promise<void> {
  for (const recipeFile of files) {
    const filePath = path.join(ctx.projectDir, recipeFile.path);

    if (recipeFile.overwriteDefault) {
      await writeFileIfMissingOrDefault(filePath, recipeFile.contents, recipeFile.overwriteDefault);
    } else {
      await writeFileIfMissing(filePath, recipeFile.contents);
    }
  }
}

async function writeFileIfMissingOrDefault(
  filePath: string,
  contents: string,
  isDefault: (existing: string) => boolean,
): Promise<void> {
  try {
    const existing = await fs.readFile(filePath, 'utf8');

    if (isDefault(existing)) {
      await fs.writeFile(filePath, contents, 'utf8');
    }
  } catch {
    await fs.writeFile(filePath, contents, 'utf8');
  }
}

interface RecipeConfigTarget {
  path: string;
  kind: 'updated' | 'skipped';
}

async function resolveRecipeConfigTarget(ctx: RecipeContext): Promise<RecipeConfigTarget> {
  try {
    const existing = await fs.readFile(ctx.configPath, 'utf8');

    if (!isDefaultStarterConfig(existing)) {
      return {
        path: path.join(ctx.recipeDir, 'fde.config.ts'),
        kind: 'skipped',
      };
    }
  } catch {
    // No config exists yet, so write the recipe config below.
  }

  return {
    path: ctx.configPath,
    kind: 'updated',
  };
}

async function writeRecipeConfig(target: RecipeConfigTarget, config: string): Promise<void> {
  if (target.kind === 'skipped') {
    await writeFileIfMissing(target.path, config);
    return;
  }

  await fs.writeFile(target.path, config, 'utf8');
}

async function upsertPackageJson(
  ctx: RecipeContext,
  patch: PackagePatch,
): Promise<void> {
  const packagePath = path.join(ctx.projectDir, 'package.json');
  let pkg: Record<string, unknown>;

  try {
    pkg = JSON.parse(await fs.readFile(packagePath, 'utf8')) as Record<string, unknown>;
  } catch {
    pkg = {
      name: ctx.projectName,
      version: '0.1.0',
      private: true,
    };
  }

  const scripts = asRecord(pkg.scripts);
  Object.assign(scripts, patch.scripts ?? {});
  setMissingValues(scripts, patch.scriptsIfMissing);

  if (patch.type) {
    pkg.type = patch.type;
  }

  const dependencies = asRecord(pkg.dependencies);
  Object.assign(dependencies, patch.dependencies ?? {});

  const devDependencies = asRecord(pkg.devDependencies);
  Object.assign(devDependencies, patch.devDependencies ?? {});

  pkg.scripts = scripts;
  pkg.dependencies = dependencies;
  pkg.devDependencies = devDependencies;

  await fs.writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

async function upsertEnvExample(projectDir: string, entries: EnvLine[]): Promise<void> {
  const envPath = path.join(projectDir, '.env.example');
  let contents = '';

  try {
    contents = await fs.readFile(envPath, 'utf8');
  } catch {
    contents = '';
  }

  const additions: string[] = [];

  for (const entry of entries) {
    if (hasEnvEntry(contents, entry.name) || additions.some((line) => line.startsWith(`${entry.name}=`))) {
      continue;
    }

    additions.push(`# ${entry.description}`);
    additions.push(`${entry.name}=${entry.value}`);
    additions.push('');
  }

  if (additions.length === 0) {
    return;
  }

  const next = [
    contents.trimEnd(),
    additions.join('\n').trimEnd(),
    '',
  ].filter(Boolean).join('\n\n');

  await fs.writeFile(envPath, `${next}\n`, 'utf8');
}

function setMissingValues(record: Record<string, unknown>, values: Record<string, string> | undefined): void {
  for (const [key, value] of Object.entries(values ?? {})) {
    if (!(key in record)) {
      record[key] = value;
    }
  }
}

function hasEnvEntry(contents: string, name: string): boolean {
  return new RegExp(`^${escapeRegExp(name)}=`, 'm').test(contents);
}
