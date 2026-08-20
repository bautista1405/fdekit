import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectSkillLoadError, loadProjectSkills } from '../skills/index.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('project-local skill loading', () => {
  it('loads reviewed manifests and verifies entrypoint integrity without executing them', async () => {
    const projectDir = await projectSkill('export default () => "review";\n');
    const loaded = await loadProjectSkills({ projectDir });

    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      digestVerified: true,
      manifest: {
        name: 'documentation-review',
        executionModes: ['diff_only', 'shadow'],
        requestedCapabilities: ['source:read'],
      },
    });
  });

  it('rejects a changed entrypoint until provenance review updates its digest', async () => {
    const projectDir = await projectSkill('export default () => "review";\n');
    await fs.writeFile(
      path.join(projectDir, 'fdekit/skills/documentation-review/index.js'),
      'export default () => "tampered";\n',
      'utf8',
    );

    await expect(loadProjectSkills({ projectDir })).rejects.toBeInstanceOf(ProjectSkillLoadError);
    await expect(loadProjectSkills({ projectDir })).rejects.toThrow('entrypoint digest mismatch');
  });
});

async function projectSkill(entrypoint: string): Promise<string> {
  const projectDir = await fs.mkdtemp(path.join(tmpdir(), 'fdekit-project-skill-'));
  temporaryDirectories.push(projectDir);
  const skillDir = path.join(projectDir, 'fdekit/skills/documentation-review');
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, 'index.js'), entrypoint, 'utf8');
  const digest = `sha256:${createHash('sha256').update(entrypoint).digest('hex')}`;
  await fs.writeFile(path.join(skillDir, 'skill.json'), JSON.stringify({
    schemaVersion: 1,
    name: 'documentation-review',
    version: '1.0.0',
    description: 'Review docs in a bounded local mode.',
    license: 'MIT',
    entrypoint: 'index.js',
    executionModes: ['diff_only', 'shadow'],
    requestedCapabilities: ['source:read'],
    requestedSourceIds: ['repo-a'],
    tools: ['codebase.readFile'],
    evalRefs: ['docs-heldout'],
    provenance: { source: 'project', digest, reviewedAt: '2026-08-19T12:00:00.000Z' },
  }, null, 2), 'utf8');
  return projectDir;
}
