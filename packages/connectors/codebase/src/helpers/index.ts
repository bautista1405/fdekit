import type { Stats } from 'fs';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { CodebaseFileEntry, CodebaseSearchMatch } from '../interfaces/index.js';

export { readEnvValue } from '@fdekit/core';

export async function collectFiles(root: string, ignore: string[], maxFileBytes: number): Promise<CodebaseFileEntry[]> {
  const files: CodebaseFileEntry[] = [];

  await walk(root, ignore, async (absolutePath, stat) => {
    if (stat.size > maxFileBytes || isLikelyBinary(absolutePath)) {
      return;
    }

    files.push({
      filePath: toRelativePath(root, absolutePath),
      bytes: stat.size,
    });
  });

  return files.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

export async function searchFiles(
  root: string,
  ignore: string[],
  maxFileBytes: number,
  query: string,
  maxResults: number,
): Promise<CodebaseSearchMatch[]> {
  const matches: CodebaseSearchMatch[] = [];
  const queryLower = query.toLowerCase();

  await walk(root, ignore, async (absolutePath, stat) => {
    if (matches.length >= maxResults || stat.size > maxFileBytes || isLikelyBinary(absolutePath)) {
      return;
    }

    const content = await fs.readFile(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].toLowerCase().includes(queryLower)) {
        continue;
      }

      matches.push({
        filePath: toRelativePath(root, absolutePath),
        line: index + 1,
        preview: lines[index].trim(),
      });

      if (matches.length >= maxResults) {
        break;
      }
    }
  });

  return matches;
}

export async function statFile(filePath: string): Promise<Stats> {
  return fs.stat(filePath);
}

export function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}

export function resolveRoot(rootDir: string): string {
  return path.resolve(rootDir);
}

export function resolveSafePath(root: string, filePath: string): string {
  const absolutePath = path.resolve(root, filePath);
  const relative = path.relative(root, absolutePath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Codebase path escapes root: ${filePath}`);
  }

  return absolutePath;
}

export function toRelativePath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

async function walk(
  dir: string,
  ignore: string[],
  visitFile: (absolutePath: string, stat: Stats) => Promise<void>,
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (ignore.includes(entry.name)) {
      continue;
    }

    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await walk(absolutePath, ignore, visitFile);
      continue;
    }

    if (entry.isFile()) {
      await visitFile(absolutePath, await fs.stat(absolutePath));
    }
  }
}

function isLikelyBinary(filePath: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|gz|tar|woff2?|ttf|eot)$/i.test(filePath);
}
