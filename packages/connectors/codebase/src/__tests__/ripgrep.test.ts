import { mkdir, mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { searchFilesRegex } from '../helpers/index.js';
import { ripgrepSearch } from '../helpers/ripgrep.js';

const ignore = ['node_modules', '.git'];
const maxFileBytes = 80_000;

async function writeFixture(rootDir: string): Promise<void> {
  await mkdir(path.join(rootDir, 'src'), { recursive: true });
  await writeFile(path.join(rootDir, 'src', 'billing.ts'), [
    'export function syncBilling() {',
    '  // TODO(fdekit): add retry handling',
    '  return true;',
    '}',
  ].join('\n'), 'utf8');
  await writeFile(path.join(rootDir, 'README.md'), '# Demo\n', 'utf8');
  await mkdir(path.join(rootDir, 'node_modules', 'dep'), { recursive: true });
  await writeFile(path.join(rootDir, 'node_modules', 'dep', 'ignored.ts'), '// TODO(fdekit): ignored\n', 'utf8');
}

describe('ripgrepSearch', () => {
  it('matches regular expressions and honors the ignore list', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-rg-'));
    await writeFixture(rootDir);

    const matches = await ripgrepSearch(rootDir, ignore, maxFileBytes, 'TODO\\(fdekit\\)|^# Demo', 20);

    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ filePath: 'README.md', line: 1, preview: '# Demo' }),
      expect.objectContaining({ filePath: 'src/billing.ts', line: 2 }),
    ]));
    expect(matches.find((match) => match.filePath.includes('node_modules'))).toBeUndefined();
  });

  it('returns an empty list when nothing matches', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-rg-'));
    await writeFixture(rootDir);

    await expect(ripgrepSearch(rootDir, ignore, maxFileBytes, 'no-such-token-anywhere', 20)).resolves.toEqual([]);
  });

  it('caps results at maxResults', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-rg-'));
    await writeFixture(rootDir);

    const matches = await ripgrepSearch(rootDir, ignore, maxFileBytes, '.', 2);

    expect(matches).toHaveLength(2);
  });

  it('rejects invalid patterns', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-rg-'));
    await writeFixture(rootDir);

    await expect(ripgrepSearch(rootDir, ignore, maxFileBytes, 'TODO(', 20)).rejects.toThrow();
  });
});

describe('searchFilesRegex (fallback scanner)', () => {
  it('matches regular expressions with the same result shape as ripgrep', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-rg-'));
    await writeFixture(rootDir);

    const matches = await searchFilesRegex(rootDir, ignore, maxFileBytes, /TODO\(fdekit\)|^# Demo/, 20);

    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ filePath: 'README.md', line: 1, preview: '# Demo' }),
      expect.objectContaining({ filePath: 'src/billing.ts', line: 2 }),
    ]));
    expect(matches.find((match) => match.filePath.includes('node_modules'))).toBeUndefined();
  });
});
