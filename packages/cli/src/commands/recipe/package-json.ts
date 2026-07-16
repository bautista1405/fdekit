import { promises as fs } from 'fs';
import * as path from 'path';
import { readJsonIfExists } from '@fdekit/runtime';
import { mergeProjectScripts } from '../../scaffolds/script-merge.js';
import type {
  CapturedRecipeManifest,
  ProjectPackageJson,
} from './types.js';

export async function mergePackageJson(projectDir: string, manifest: CapturedRecipeManifest): Promise<void> {
  if (!manifest.package) {
    return;
  }

  const packagePath = path.join(projectDir, 'package.json');
  const existing = await readJsonIfExists<ProjectPackageJson>(packagePath) ?? {
    name: path.basename(projectDir),
    version: '0.1.0',
    private: true,
  };

  existing.scripts = mergeScripts(existing.scripts, manifest.package.scripts);
  existing.dependencies = mergeStringRecords(existing.dependencies, manifest.package.dependencies);
  existing.devDependencies = mergeStringRecords(existing.devDependencies, manifest.package.devDependencies);

  await fs.writeFile(packagePath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
}

function mergeScripts(existing: unknown, incoming: unknown): Record<string, string> | undefined {
  const merged = mergeProjectScripts(
    stringRecord(existing) ?? {},
    stringRecord(incoming) ?? {},
  ) as Record<string, string>;

  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .sort(([left], [right]) => left.localeCompare(right));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function mergeStringRecords(
  existing: unknown,
  incoming: unknown,
): Record<string, string> | undefined {
  const result = {
    ...(stringRecord(incoming) ?? {}),
    ...(stringRecord(existing) ?? {}),
  };

  return Object.keys(result).length > 0 ? result : undefined;
}
