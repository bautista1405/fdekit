import { promises as fs } from 'fs';
import * as path from 'path';

export async function readJsonFiles<T = unknown>(dir: string): Promise<T[]> {
  try {
    const entries = await fs.readdir(dir);
    const values: T[] = [];

    for (const entry of entries.filter((name) => name.endsWith('.json')).sort()) {
      const value = await readJsonIfExists<T>(path.join(dir, entry));
      if (value) {
        values.push(value);
      }
    }

    return values;
  } catch {
    return [];
  }
}

export async function readJsonIfExists<T = unknown>(filePath: string): Promise<T | null> {
  return readJsonFile<T>(filePath);
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function parseJsonl<T>(contents: string | null): T[] {
  if (!contents) {
    return [];
  }

  return contents
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
