import { promises as fs } from 'fs';
import * as path from 'path';
import { writeFileIfMissing } from '../../utils/files.js';

export async function copyInstallAsset(sourceRecipeDir: string, projectDir: string, relativePath: string): Promise<void> {
  const source = path.join(sourceRecipeDir, relativePath);
  const target = path.join(projectDir, relativePath);

  if (await isDirectory(source)) {
    await copyDir(source, target, { overwrite: false });
    return;
  }

  if (await exists(source)) {
    await writeFileIfMissing(target, await fs.readFile(source, 'utf8'));
  }
}

export async function copyDir(source: string, target: string, options: { overwrite: boolean }): Promise<void> {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldSkipEntry(entry.name)) {
      continue;
    }

    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath, options);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, targetPath, options.overwrite);
    }
  }
}

export async function copyFile(source: string, target: string, overwrite: boolean): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });

  if (!overwrite && await exists(target)) {
    return;
  }

  await fs.copyFile(source, target);
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

function shouldSkipEntry(name: string): boolean {
  return [
    'node_modules',
    '.fdekit',
    '.git',
    '.turbo',
    'dist',
    '.results',
  ].includes(name);
}
