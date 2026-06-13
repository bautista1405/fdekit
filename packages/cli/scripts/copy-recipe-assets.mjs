#!/usr/bin/env node
import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRecipesDir = join(packageDir, 'src', 'scaffolds', 'recipes');
const distRecipesDir = join(packageDir, 'dist', 'scaffolds', 'recipes');

await mkdir(distRecipesDir, { recursive: true });

for (const entry of await readdir(sourceRecipesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }

  const sourceFilesDir = join(sourceRecipesDir, entry.name, 'files');
  const distFilesDir = join(distRecipesDir, entry.name, 'files');

  await cp(sourceFilesDir, distFilesDir, {
    recursive: true,
    force: true,
    errorOnExist: false,
  }).catch((error) => {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  });
}
