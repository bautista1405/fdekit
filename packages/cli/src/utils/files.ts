import { promises as fs } from 'fs';

export async function writeFileIfMissing(filePath: string, contents: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, contents, 'utf8');
  }
}
