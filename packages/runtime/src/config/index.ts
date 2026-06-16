import { promises as fs } from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { DeploymentDefinition } from '@fdekit/core';
import {
  cachedModuleFileName,
  loadProjectEnv,
  rewriteConfigRelativeImports,
  rewriteFdekitImports,
} from './helpers/index.js';

export class ConfigNotFoundError extends Error {
  constructor(startDir: string) {
    super(`No fde.config.ts found in ${startDir} or its parent directories`);
    this.name = 'ConfigNotFoundError';
  }
}

export async function findConfigFile(startDir: string): Promise<string | null> {
  let dir = startDir;

  while (true) {
    const candidate = path.join(dir, 'fde.config.ts');
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      //keep searching
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return null;
}

export async function requireConfigFile(startDir: string): Promise<string> {
  const configPath = await findConfigFile(startDir);
  if (!configPath) {
    throw new ConfigNotFoundError(startDir);
  }

  return configPath;
}

export async function findProjectDir(startDir: string): Promise<string> {
  const configPath = await findConfigFile(startDir);
  return configPath ? path.dirname(configPath) : startDir;
}

let configImportCounter = 0;

export async function loadDeployment(configPath: string): Promise<DeploymentDefinition> {
  await loadProjectEnv(path.dirname(configPath));

  const source = await fs.readFile(configPath, 'utf8');
  const ts = await import('typescript');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      esModuleInterop: true,
    },
    fileName: configPath,
  }).outputText;

  const cacheDir = path.join(path.dirname(configPath), '.fdekit', 'cache');
  await fs.mkdir(cacheDir, { recursive: true });
  const executableConfig = await rewriteConfigRelativeImports(
    await rewriteFdekitImports(transpiled),
    configPath,
    cacheDir,
  );

  const compiledPath = path.join(cacheDir, cachedModuleFileName(configPath, executableConfig));
  await writeConfigCacheFile(compiledPath, executableConfig);
  await pruneLegacyConfigCacheEntries(cacheDir);

  const moduleUrl = `${pathToFileURL(compiledPath).href}?load=${++configImportCounter}`;
  const imported = await import(moduleUrl);
  const deployment = imported.default ?? imported.deployment ?? imported;

  if (!deployment || typeof deployment !== 'object') {
    throw new Error(`Config did not export a deployment object: ${configPath}`);
  }

  return deployment as DeploymentDefinition;
}

async function writeConfigCacheFile(filePath: string, source: string): Promise<void> {
  try {
    await fs.writeFile(filePath, source, { encoding: 'utf8', flag: 'wx' });
  } catch (err) {
    if (errorCode(err) !== 'EEXIST') {
      throw err;
    }
  }
}

async function pruneLegacyConfigCacheEntries(cacheDir: string): Promise<void> {
  const entries = await fs.readdir(cacheDir);

  await Promise.all(entries.map(async (entry) => {
    if (!isLegacyConfigCacheEntry(entry)) {
      return;
    }

    try {
      await fs.unlink(path.join(cacheDir, entry));
    } catch {
      // Another process may have pruned it first.
    }
  }));
}

function isLegacyConfigCacheEntry(fileName: string): boolean {
  return /^fde\.config\d+\.mjs$/.test(fileName);
}

function errorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object' || !('code' in err)) {
    return undefined;
  }

  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
