import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { validateProjectSkillManifest, type ProjectSkillManifest } from '@fdekit/core';

export * from './documentation-shadow.js';

export interface LoadedProjectSkill {
  manifest: ProjectSkillManifest;
  directory: string;
  entrypoint: string;
  digestVerified: true;
}

export interface LoadProjectSkillsOptions {
  projectDir: string;
  /** Defaults to `fdekit/skills` relative to projectDir. */
  rootDir?: string;
}

export class ProjectSkillLoadError extends Error {
  constructor(readonly skillPath: string, message: string) {
    super(`Could not load project skill ${skillPath}: ${message}`);
    this.name = 'ProjectSkillLoadError';
  }
}

/** Load and integrity-check manifests only. This function never executes a skill. */
export async function loadProjectSkills(options: LoadProjectSkillsOptions): Promise<LoadedProjectSkill[]> {
  const root = path.resolve(options.projectDir, options.rootDir ?? 'fdekit/skills');
  let entries: Array<import('fs').Dirent>;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return [];
    throw error;
  }

  const loaded: LoadedProjectSkill[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) throw new ProjectSkillLoadError(entry.name, 'symbolic-link skill directories are not allowed.');
    if (!entry.isDirectory()) continue;
    loaded.push(await loadProjectSkill(root, entry.name));
  }
  return loaded;
}

async function loadProjectSkill(root: string, name: string): Promise<LoadedProjectSkill> {
  const directory = path.join(root, name);
  const manifestPath = path.join(directory, 'skill.json');
  let value: unknown;
  try {
    value = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as unknown;
  } catch (error) {
    throw new ProjectSkillLoadError(name, error instanceof Error ? error.message : String(error));
  }

  const validation = validateProjectSkillManifest(value);
  if (!validation.valid) {
    throw new ProjectSkillLoadError(
      name,
      validation.issues.map((issue) => `${issue.path || '<root>'}: ${issue.message}`).join('; '),
    );
  }
  const manifest = value as ProjectSkillManifest;
  const entrypoint = path.resolve(directory, manifest.entrypoint);
  const relative = path.relative(directory, entrypoint);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectSkillLoadError(name, 'entrypoint escapes the skill directory.');
  }
  const realDirectory = await fs.realpath(directory);
  const realEntrypoint = await fs.realpath(entrypoint).catch((error) => {
    throw new ProjectSkillLoadError(name, error instanceof Error ? error.message : String(error));
  });
  const realRelative = path.relative(realDirectory, realEntrypoint);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new ProjectSkillLoadError(name, 'entrypoint resolves outside the skill directory.');
  }
  const digest = `sha256:${createHash('sha256').update(await fs.readFile(realEntrypoint)).digest('hex')}`;
  if (digest !== manifest.provenance.digest) {
    throw new ProjectSkillLoadError(name, `entrypoint digest mismatch; expected ${manifest.provenance.digest}, found ${digest}.`);
  }

  return { manifest, directory: realDirectory, entrypoint: realEntrypoint, digestVerified: true };
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}
