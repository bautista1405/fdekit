import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import { createRequire } from 'module';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { escapeRegExp } from '@fdekit/core';

const requireFromRuntime = createRequire(import.meta.url);
const fdekitLoadedEnvKeys = new Set<string>();
const localModuleExtensions = new Set(['.js', '.mjs', '.ts']);


export async function loadProjectEnv(projectDir: string): Promise<void> {
  const envPath = path.join(projectDir, '.env');
  let contents: string;

  try {
    contents = await fs.readFile(envPath, 'utf8');
  } catch {
    return;
  }

  for (const [name, value] of parseDotEnv(contents)) {
    if (process.env[name] === undefined || fdekitLoadedEnvKeys.has(name)) {
      process.env[name] = value;
      fdekitLoadedEnvKeys.add(name);
    }
  }
}

function parseDotEnv(contents: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalized = line.startsWith('export ') ? line.slice('export '.length).trimStart() : line;
    const equalsIndex = normalized.indexOf('=');

    if (equalsIndex <= 0) {
      continue;
    }

    const name = normalized.slice(0, equalsIndex).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      continue;
    }

    entries.push([name, parseEnvValue(normalized.slice(equalsIndex + 1).trim())]);
  }

  return entries;
}

function parseEnvValue(value: string): string {
  const commentIndex = value.search(/\s#/);
  const withoutComment = commentIndex >= 0 ? value.slice(0, commentIndex).trimEnd() : value;

  if (
    (withoutComment.startsWith('"') && withoutComment.endsWith('"'))
    || (withoutComment.startsWith("'") && withoutComment.endsWith("'"))
  ) {
    return withoutComment.slice(1, -1);
  }

  return withoutComment;
}

export async function rewriteFdekitImports(source: string): Promise<string> {
  const specifiers = new Set(source.match(/@fdekit\/[A-Za-z0-9-]+/g) ?? []);
  let rewritten = source;

  for (const specifier of specifiers) {
    const resolved = await resolveFdekitSpecifier(specifier);

    if (!resolved) {
      continue;
    }

    const escaped = escapeRegExp(specifier);

    rewritten = rewritten
      .replace(new RegExp(`from\\s+['"]${escaped}['"]`, 'g'), `from '${resolved}'`)
      .replace(new RegExp(`import\\(\\s*['"]${escaped}['"]\\s*\\)`, 'g'), `import('${resolved}')`);
  }

  return rewritten;
}

export async function rewriteConfigRelativeImports(
  source: string,
  configPath: string,
  cacheDir: string,
): Promise<string> {
  return rewriteLocalImports(source, configPath, cacheDir, new Map());
}

async function rewriteLocalImports(
  source: string,
  importerPath: string,
  cacheDir: string,
  seen: Map<string, Promise<string>>,
): Promise<string> {
  const pattern = /((?:from\s+|import\s+|import\(\s*)['"])(\.[^'"]+)(['"])/g;
  let rewritten = '';
  let lastIndex = 0;

  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    const [fullMatch, prefix, specifier, suffix] = match;
    const localUrl = await resolveLocalImport(specifier, importerPath, cacheDir, seen);

    rewritten += source.slice(lastIndex, index);
    rewritten += `${prefix}${localUrl}${suffix}`;
    lastIndex = index + fullMatch.length;
  }

  return `${rewritten}${source.slice(lastIndex)}`;
}

async function resolveLocalImport(
  specifier: string,
  importerPath: string,
  cacheDir: string,
  seen: Map<string, Promise<string>>,
): Promise<string> {
  const resolvedPath = path.resolve(path.dirname(importerPath), specifier);
  const extension = path.extname(resolvedPath);

  if (!localModuleExtensions.has(extension)) {
    return pathToFileURL(resolvedPath).href;
  }

  return cacheLocalModule(resolvedPath, cacheDir, seen);
}

async function cacheLocalModule(
  modulePath: string,
  cacheDir: string,
  seen: Map<string, Promise<string>>,
): Promise<string> {
  const existing = seen.get(modulePath);

  if (existing) {
    return existing;
  }

  const pending = writeCachedLocalModule(modulePath, cacheDir, seen);
  seen.set(modulePath, pending);

  return pending;
}

async function writeCachedLocalModule(
  modulePath: string,
  cacheDir: string,
  seen: Map<string, Promise<string>>,
): Promise<string> {
  let source: string;

  try {
    source = await fs.readFile(modulePath, 'utf8');
  } catch {
    return pathToFileURL(modulePath).href;
  }

  const rewrittenFdekitImports = await rewriteFdekitImports(source);
  const rewrittenLocalImports = await rewriteLocalImports(rewrittenFdekitImports, modulePath, cacheDir, seen);
  const compiledSource = path.extname(modulePath) === '.ts'
    ? await transpileLocalModule(rewrittenLocalImports, modulePath)
    : rewrittenLocalImports;
  const cachePath = path.join(cacheDir, cachedModuleFileName(modulePath, compiledSource));

  await fs.writeFile(cachePath, compiledSource, 'utf8');

  return pathToFileURL(cachePath).href;
}

async function transpileLocalModule(source: string, fileName: string): Promise<string> {
  const ts = await import('typescript');

  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      esModuleInterop: true,
    },
    fileName,
  }).outputText;
}

function cachedModuleFileName(modulePath: string, source: string): string {
  const baseName = path.basename(modulePath).replace(/[^A-Za-z0-9._-]/g, '_');
  const hash = createHash('sha256').update(modulePath).update(source).digest('hex').slice(0, 12);

  return `${baseName}-${hash}.mjs`;
}

async function resolveFdekitSpecifier(specifier: string): Promise<string | null> {
  const resolver = (import.meta as unknown as { resolve?: (specifier: string) => string }).resolve;

  try {
    return resolver
      ? resolver(specifier)
      : pathToFileURL(requireFromRuntime.resolve(specifier)).href;
  } catch {
    return null;
  }
}
