import { promises as fs } from 'fs';

export async function writeFileIfMissing(filePath: string, contents: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, contents, 'utf8');
  }
}

export async function writeBakFile(filePath: string, contents: string): Promise<string> {
  const backupPath = await nextBakPath(filePath);
  await fs.writeFile(backupPath, contents, 'utf8');
  return backupPath;
}

async function nextBakPath(filePath: string): Promise<string> {
  const firstChoice = `${filePath}.bak`;

  if (await isMissing(firstChoice)) {
    return firstChoice;
  }

  for (let index = 1; ; index += 1) {
    const candidate = `${filePath}.${index}.bak`;

    if (await isMissing(candidate)) {
      return candidate;
    }
  }
}

async function isMissing(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return false;
  } catch {
    return true;
  }
}
