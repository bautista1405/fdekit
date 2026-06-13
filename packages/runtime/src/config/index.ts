import { promises as fs } from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { DeploymentDefinition } from '@fdekit/core';
import { loadProjectEnv, rewriteConfigRelativeImports, rewriteFdekitImports } from './helpers/index.js';

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

  const compiledPath = path.join(cacheDir, `fde.config${Date.now()}.mjs`);
  await fs.writeFile(compiledPath, executableConfig, 'utf8');

  const moduleUrl = `${pathToFileURL(compiledPath).href}?t=${Date.now()}`;
  const imported = await import(moduleUrl);
  const deployment = imported.default ?? imported.deployment ?? imported;

  if (!deployment || typeof deployment !== 'object') {
    throw new Error(`Config did not export a deployment object: ${configPath}`);
  }

  return deployment as DeploymentDefinition;
}
