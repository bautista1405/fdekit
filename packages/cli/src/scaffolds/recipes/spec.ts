import {
  baseScripts,
  file,
  installRecipe,
  jsonFile,
  managedFile,
  type EnvLine,
  type PackagePatch,
  type Recipe,
  type RecipeContext,
  type RecipeInstallResult,
} from '../registry.js';
import type { RecipeManifest } from '../../catalog/types.js';

type RecipeValue<T> = T | ((ctx: RecipeContext) => T);

export type RecipeFileSpec =
  | {
      kind?: 'text';
      path: string;
      contents: RecipeValue<string>;
      overwriteDefault?: (existing: string) => boolean;
    }
  | {
      kind: 'json';
      path: string;
      value: RecipeValue<unknown>;
      overwriteDefault?: (existing: string) => boolean;
    };

export interface RecipeRunScriptsSpec {
  namespace?: string;
  run: string;
}

export interface RecipePackageSpec {
  type?: string;
  serviceScripts?: Record<string, string>;
  fdekitScripts?: RecipeRunScriptsSpec;
  scripts?: Record<string, string>;
  scriptsIfMissing?: 'base' | Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface RecipeSpec {
  name: string;
  manifest: RecipeManifest;
  directories?: string[];
  files: RecipeValue<RecipeFileSpec[]>;
  package?: RecipeValue<RecipePackageSpec>;
  env?: RecipeValue<EnvLine[]>;
  gitignore?: string;
  config: (ctx: RecipeContext) => string;
}

export const recipeGitignore = `.fdekit
node_modules
.env
`;

export function defineRecipe(spec: RecipeSpec): Recipe {
  return {
    name: spec.name,
    directories: spec.directories,
    files: (ctx) => resolveValue(spec.files, ctx).map((recipeFile) => renderRecipeFile(ctx, recipeFile)),
    package: spec.package
      ? (ctx) => renderPackagePatch(resolveValue(spec.package as RecipeValue<RecipePackageSpec>, ctx))
      : undefined,
    env: spec.env,
    gitignore: spec.gitignore,
    config: spec.config,
  };
}

export async function installRecipeSpec(projectDir: string, spec: RecipeSpec): Promise<RecipeInstallResult> {
  return installRecipe(projectDir, defineRecipe(spec));
}

function renderRecipeFile(ctx: RecipeContext, spec: RecipeFileSpec) {
  if (spec.kind === 'json') {
    return jsonFile(spec.path, resolveValue(spec.value, ctx), spec.overwriteDefault);
  }

  const contents = resolveValue(spec.contents, ctx);

  return spec.overwriteDefault
    ? managedFile(spec.path, contents, spec.overwriteDefault)
    : file(spec.path, contents);
}

function renderPackagePatch(spec: RecipePackageSpec): PackagePatch {
  return {
    type: spec.type,
    scripts: {
      ...spec.serviceScripts,
      ...(spec.fdekitScripts ? renderFdekitScripts(spec.fdekitScripts) : {}),
      ...spec.scripts,
    },
    scriptsIfMissing: spec.scriptsIfMissing === 'base'
      ? baseScripts
      : spec.scriptsIfMissing,
    dependencies: spec.dependencies,
    devDependencies: spec.devDependencies,
  };
}

function renderFdekitScripts(spec: RecipeRunScriptsSpec): Record<string, string> {
  const key = (name: string) => spec.namespace
    ? `fdekit:${spec.namespace}:${name}`
    : `fdekit:${name}`;

  return {
    [key('doctor')]: 'fdekit doctor',
    [key('dev')]: 'fdekit dev',
    [key('run')]: spec.run,
    [key('approvals')]: 'fdekit approvals list',
    [key('audit')]: 'fdekit audit',
    [key('feedback')]: 'fdekit feedback export',
    [key('validate')]: 'fdekit validate',
    [key('validate:strict')]: 'fdekit validate --strict',
    [key('diff')]: 'fdekit diff',
    [key('eval')]: 'fdekit eval run',
    [key('macro')]: 'fdekit eval macro',
    [key('trace')]: 'fdekit trace',
    [key('report')]: 'fdekit report',
    [key('console')]: 'fdekit console',
  };
}

function resolveValue<T>(value: RecipeValue<T>, ctx: RecipeContext): T {
  return typeof value === 'function'
    ? (value as (ctx: RecipeContext) => T)(ctx)
    : value;
}
