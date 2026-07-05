import { execFile } from 'child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { describe, expect, it } from 'vitest';
import { gitDiff, parseUnifiedDiff } from '../helpers/git-diff.js';

const run = promisify(execFile);
const maxPatchBytes = 80_000;

async function initFixtureRepo(): Promise<string> {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-diff-'));
  const git = (...args: string[]) => run('git', args, { cwd: rootDir });

  await git('init', '-q', '-b', 'main');
  await git('config', 'user.email', 'test@fdekit.dev');
  await git('config', 'user.name', 'FDEKit Test');
  await mkdir(path.join(rootDir, 'src'), { recursive: true });
  await writeFile(path.join(rootDir, 'src', 'billing.ts'), [
    'export function syncBilling(): boolean {',
    '  return true;',
    '}',
    '',
  ].join('\n'), 'utf8');
  await writeFile(path.join(rootDir, 'src', 'old-name.ts'), 'export const KEEP = 1;\n', 'utf8');
  await writeFile(path.join(rootDir, 'src', 'to-delete.ts'), 'export const GONE = 1;\n', 'utf8');
  await git('add', '.');
  await git('commit', '-q', '-m', 'base');
  await git('checkout', '-q', '-b', 'feature');
  await writeFile(path.join(rootDir, 'src', 'billing.ts'), [
    'export function syncBilling(): boolean {',
    '  const retries = 3;',
    '  return retries > 0;',
    '}',
    '',
  ].join('\n'), 'utf8');
  await git('mv', 'src/old-name.ts', 'src/new-name.ts');
  await rm(path.join(rootDir, 'src', 'to-delete.ts'));
  await writeFile(path.join(rootDir, 'src', 'added.ts'), 'export const FRESH = 1;\nexport const ALSO = 2;\n', 'utf8');
  await git('add', '-A');
  await git('commit', '-q', '-m', 'feature changes');

  return rootDir;
}

describe('gitDiff', () => {
  it('reports added, modified, deleted, and renamed files with hunks and stats', async () => {
    const rootDir = await initFixtureRepo();
    const files = await gitDiff(rootDir, 'main', 'feature', maxPatchBytes);
    const byPath = Object.fromEntries(files.map((file) => [file.filePath, file]));

    expect(byPath['src/added.ts']).toMatchObject({ status: 'added', additions: 2, deletions: 0 });
    expect(byPath['src/to-delete.ts']).toMatchObject({ status: 'deleted', additions: 0, deletions: 1 });
    expect(byPath['src/new-name.ts']).toMatchObject({
      status: 'renamed',
      previousPath: 'src/old-name.ts',
      hunks: [],
    });

    const billing = byPath['src/billing.ts'];
    expect(billing).toMatchObject({ status: 'modified', additions: 2, deletions: 1, binary: false });
    expect(billing.hunks).toHaveLength(1);
    expect(billing.hunks[0].newStart).toBe(1);
    expect(billing.hunks[0].patch).toContain('+  const retries = 3;');
    expect(billing.hunks[0].patch).toContain('-  return true;');
  });

  it('caps patch text at the byte budget while keeping full line stats', async () => {
    const rootDir = await initFixtureRepo();
    const files = await gitDiff(rootDir, 'main', 'feature', 10);
    const billing = files.find((file) => file.filePath === 'src/billing.ts');

    expect(billing?.patchTruncated).toBe(true);
    expect(billing?.additions).toBe(2);
    expect(billing?.deletions).toBe(1);
    expect(Buffer.byteLength(billing?.hunks[0]?.patch ?? '', 'utf8')).toBeLessThanOrEqual(10);
  });

  it('rejects roots that are not inside a git work tree', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-nogit-'));

    await expect(gitDiff(rootDir, 'main', 'HEAD', maxPatchBytes)).rejects.toThrow('not inside a git work tree');
  });
});

describe('parseUnifiedDiff', () => {
  it('parses binary file markers without hunks', () => {
    const raw = [
      'diff --git a/logo.png b/logo.png',
      'new file mode 100644',
      'index 0000000..1111111',
      'Binary files /dev/null and b/logo.png differ',
      '',
    ].join('\n');

    expect(parseUnifiedDiff(raw, maxPatchBytes)).toEqual([
      expect.objectContaining({ filePath: 'logo.png', status: 'added', binary: true, hunks: [], additions: 0, deletions: 0 }),
    ]);
  });

  it('returns an empty list for an empty diff', () => {
    expect(parseUnifiedDiff('', maxPatchBytes)).toEqual([]);
  });
});
