import { promises as fs } from 'fs';
import * as path from 'path';
import { readJsonFile, parseJsonl } from './json.js';
import { DEFAULT_ARTIFACT_ROOT, localGroupPath, localPath } from './paths.js';
import type { ArtifactRef, ArtifactStore, FileArtifactStoreOptions } from './types.js';

export function createFileArtifactStore(options: FileArtifactStoreOptions): ArtifactStore {
  const root = path.isAbsolute(options.rootDir ?? '')
    ? (options.rootDir as string)
    : path.join(options.projectDir, options.rootDir ?? DEFAULT_ARTIFACT_ROOT);

  return {
    kind: 'local',
    rootUri: root,
    uri(ref: ArtifactRef) {
      return localPath(root, ref);
    },
    async writeJson(ref, value) {
      return writeFileArtifact(root, ref, `${JSON.stringify(value, null, 2)}\n`);
    },
    async readJson<T>(ref: ArtifactRef) {
      return readJsonFile<T>(localPath(root, ref));
    },
    async listJson<T>(group: string) {
      try {
        const dir = localGroupPath(root, group);
        const entries = await fs.readdir(dir);
        const values = await Promise.all(entries
          .filter((name) => name.endsWith('.json'))
          .sort()
          .map((entry) => readJsonFile(path.join(dir, entry))));

        return values.filter((value): value is T => Boolean(value));
      } catch {
        return [];
      }
    },
    async writeText(ref, contents) {
      return writeFileArtifact(root, ref, contents);
    },
    async readText(ref) {
      try {
        return await fs.readFile(localPath(root, ref), 'utf8');
      } catch {
        return null;
      }
    },
    async appendJsonl(ref, value) {
      const filePath = localPath(root, ref);

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, 'utf8');

      return filePath;
    },
    async readJsonl<T>(ref: ArtifactRef) {
      try {
        return parseJsonl<T>(await fs.readFile(localPath(root, ref), 'utf8'));
      } catch {
        return [];
      }
    },
  };
}

async function writeFileArtifact(root: string, ref: ArtifactRef, contents: string): Promise<string> {
  const filePath = localPath(root, ref);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, 'utf8');

  return filePath;
}
