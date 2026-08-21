import { execFile } from 'child_process';
import { mkdir, mkdtemp, readdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { describe, expect, it, vi } from 'vitest';
import { codebaseConnector } from '../index.js';

const execFileAsync = promisify(execFile);

// The integration cases below create repositories and run Git/ripgrep. Keep
// their budget stable under full-workspace parallel test load.
vi.setConfig({ testTimeout: 15_000 });

describe('codebaseConnector', () => {
  it('declares allowed environments on every tool', () => {
    const connector = codebaseConnector();

    for (const tool of connector.tools ?? []) {
      expect(tool.environments).toEqual(['local', 'development', 'staging']);
    }
  });

  it('documents codebase.search as regular expression matching', () => {
    const connector = codebaseConnector();
    const search = connector.tools?.find((tool) => tool.name === 'codebase.search');
    const argsSchema = search?.argsSchema as {
      properties?: {
        query?: {
          description?: string;
        };
      };
    };

    expect(search?.description).toContain('regular expression');
    expect(argsSchema.properties?.query?.description).toContain('ripgrep');
  });

  it('resolves relative roots from the loaded FDEKit project directory', () => {
    const contained = codebaseConnector({
      env: {
        FDEKIT_PROJECT_DIR: '/customer/app/fdekit',
      },
    });
    const recipe = codebaseConnector({
      rootDir: './sample-repo',
      env: {
        FDEKIT_PROJECT_DIR: '/customer/app/fdekit',
      },
    });

    expect(contained.config.rootDir).toBe(path.resolve('/customer/app'));
    expect(recipe.config.rootDir).toBe(path.resolve('/customer/app/fdekit/sample-repo'));
  });

  it('lists, searches, and reads files within the configured root', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-codebase-'));
    await mkdir(path.join(rootDir, 'src'), { recursive: true });
    await writeFile(path.join(rootDir, 'src', 'billing.ts'), [
      'export function syncBilling() {',
      '  // TODO(fdekit): add retry handling before production rollout',
      '  return true;',
      '}',
    ].join('\n'), 'utf8');
    await writeFile(path.join(rootDir, 'README.md'), '# Demo\n', 'utf8');

    const connector = codebaseConnector({ rootDir });
    const listFiles = connector.tools?.find((tool) => tool.name === 'codebase.listFiles');
    const search = connector.tools?.find((tool) => tool.name === 'codebase.search');
    const read = connector.tools?.find((tool) => tool.name === 'codebase.readFile');

    await expect(listFiles?.handler({ pattern: 'src' }, {})).resolves.toMatchObject({
      files: [{ filePath: 'src/billing.ts' }],
    });
    await expect(search?.handler({ query: 'TODO\\(fdekit\\)' }, {})).resolves.toMatchObject({
      query: 'TODO\\(fdekit\\)',
      matches: [
        {
          filePath: 'src/billing.ts',
          line: 2,
          preview: '// TODO(fdekit): add retry handling before production rollout',
        },
      ],
    });
    await expect(search?.handler({ query: 'TODO\\(fdekit\\)|# Demo' }, {})).resolves.toMatchObject({
      matches: expect.arrayContaining([
        expect.objectContaining({ filePath: 'README.md', line: 1 }),
        expect.objectContaining({ filePath: 'src/billing.ts', line: 2 }),
      ]),
    });
    await expect(read?.handler({ filePath: 'src/billing.ts', startLine: 2, endLine: 2 }, {})).resolves.toMatchObject({
      filePath: 'src/billing.ts',
      content: '  // TODO(fdekit): add retry handling before production rollout',
      startLine: 2,
      endLine: 2,
      truncated: false,
    });
  });

  it('blocks file reads that escape the codebase root', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-codebase-'));
    const connector = codebaseConnector({ rootDir });
    const read = connector.tools?.find((tool) => tool.name === 'codebase.readFile');

    await expect(read?.handler({ filePath: '../secret.txt' }, {})).rejects.toThrow('escapes root');
  });

  it('lists and filters indexed symbol declarations', async () => {
    const rootDir = await writeNavFixture();
    const connector = codebaseConnector({ rootDir });
    const symbols = connector.tools?.find((tool) => tool.name === 'codebase.symbols');

    const all = await symbols?.handler({}, {}) as { symbols: Array<{ name: string; kind: string }> };
    expect(all.symbols.map((symbol) => symbol.name)).toEqual(expect.arrayContaining(['Invoice', 'syncBilling', 'renderApp']));

    await expect(symbols?.handler({ kind: 'interface' }, {})).resolves.toMatchObject({
      symbols: [expect.objectContaining({ name: 'Invoice', kind: 'interface', exported: true })],
    });
    await expect(symbols?.handler({ name: 'sync' }, {})).resolves.toMatchObject({
      symbols: [expect.objectContaining({ name: 'syncBilling', filePath: 'src/billing.ts' })],
    });
    await expect(symbols?.handler({ filePath: 'src/app.ts' }, {})).resolves.toMatchObject({
      symbols: [expect.objectContaining({ name: 'renderApp' })],
    });
  });

  it('finds usages of a symbol separated from its declaration sites', async () => {
    const rootDir = await writeNavFixture();
    const connector = codebaseConnector({ rootDir });
    const usages = connector.tools?.find((tool) => tool.name === 'codebase.usages');

    const result = await usages?.handler({ symbol: 'syncBilling' }, {}) as {
      definitions: Array<{ filePath: string; startLine: number }>;
      usages: Array<{ filePath: string; line: number }>;
    };

    expect(result.definitions).toEqual([
      expect.objectContaining({ filePath: 'src/billing.ts', startLine: 4 }),
    ]);
    expect(result.usages).toEqual(expect.arrayContaining([
      expect.objectContaining({ filePath: 'src/app.ts', line: 1 }),
      expect.objectContaining({ filePath: 'src/app.ts', line: 4 }),
    ]));
    expect(result.usages.find((usage) => usage.filePath === 'src/billing.ts' && usage.line === 4)).toBeUndefined();

    await expect(usages?.handler({ symbol: '   ' }, {})).rejects.toThrow('non-empty symbol');
  });

  it('reports the import graph for a source file', async () => {
    const rootDir = await writeNavFixture();
    await mkdir(path.join(rootDir, 'src', 'util'), { recursive: true });
    await writeFile(path.join(rootDir, 'src', 'util', 'index.ts'), 'export const UTIL = 1;\n', 'utf8');
    await writeFile(path.join(rootDir, 'src', 'uses-util.ts'), [
      "import { UTIL } from './util';",
      'export const DOUBLED = UTIL * 2;',
    ].join('\n'), 'utf8');
    const connector = codebaseConnector({ rootDir });
    const deps = connector.tools?.find((tool) => tool.name === 'codebase.deps');

    await expect(deps?.handler({ filePath: 'src/app.ts' }, {})).resolves.toMatchObject({
      filePath: 'src/app.ts',
      imports: ['./billing.js'],
      importedBy: [],
    });
    await expect(deps?.handler({ filePath: 'src/billing.ts' }, {})).resolves.toMatchObject({
      imports: [],
      importedBy: ['src/app.ts'],
    });
    await expect(deps?.handler({ filePath: 'src/util/index.ts' }, {})).resolves.toMatchObject({
      importedBy: ['src/uses-util.ts'],
    });
    await expect(deps?.handler({ filePath: 'missing.ts' }, {})).rejects.toThrow('not in the symbol index');
  });

  it('assembles definition bodies and usage previews for a symbol', async () => {
    const rootDir = await writeNavFixture();
    const connector = codebaseConnector({ rootDir });
    const context = connector.tools?.find((tool) => tool.name === 'codebase.context');

    const result = await context?.handler({ symbol: 'syncBilling' }, {}) as {
      definitions: Array<{ filePath: string; content: string; truncated: boolean }>;
      usages: Array<{ filePath: string; line: number }>;
    };

    expect(result.definitions).toEqual([
      expect.objectContaining({ filePath: 'src/billing.ts', truncated: false }),
    ]);
    expect(result.definitions[0].content).toContain('export function syncBilling(): boolean {');
    expect(result.usages).toEqual(expect.arrayContaining([
      expect.objectContaining({ filePath: 'src/app.ts', line: 4 }),
    ]));

    const budgeted = await context?.handler({ symbol: 'syncBilling', maxBytes: 10 }, {}) as {
      definitions: Array<{ content: string; truncated: boolean }>;
    };

    expect(budgeted.definitions[0].truncated).toBe(true);
    expect(budgeted.definitions[0].content.length).toBeLessThanOrEqual(10);
  });

  it('exposes structured git diffs through codebase.diff', async () => {
    const rootDir = await writeNavFixture();
    const git = (...args: string[]) => execFileAsync('git', args, { cwd: rootDir });
    await git('init', '-q', '-b', 'main');
    await git('config', 'user.email', 'test@fdekit.dev');
    await git('config', 'user.name', 'FDEKit Test');
    await git('add', '.');
    await git('commit', '-q', '-m', 'base');
    await writeFile(path.join(rootDir, 'src', 'billing.ts'), [
      'export interface Invoice {',
      '  id: string;',
      '  total: number;',
      '}',
      'export function syncBilling(): boolean {',
      '  return true;',
      '}',
    ].join('\n'), 'utf8');
    await git('commit', '-aqm', 'change');

    const connector = codebaseConnector({ rootDir });
    const diff = connector.tools?.find((tool) => tool.name === 'codebase.diff');

    await expect(diff?.handler({ base: 'HEAD~1' }, {})).resolves.toMatchObject({
      base: 'HEAD~1',
      head: 'HEAD',
      truncated: false,
      files: [
        expect.objectContaining({ filePath: 'src/billing.ts', status: 'modified', additions: 1 }),
      ],
    });
    await expect(diff?.handler({ base: '   ' }, {})).rejects.toThrow('non-empty base ref');
  });

  it('ranks changed files by churn and fan-in through codebase.rankDiff', async () => {
    const rootDir = await writeNavFixture();
    await writeFile(path.join(rootDir, 'README.md'), '# Demo\n', 'utf8');
    const git = (...args: string[]) => execFileAsync('git', args, { cwd: rootDir });
    await git('init', '-q', '-b', 'main');
    await git('config', 'user.email', 'test@fdekit.dev');
    await git('config', 'user.name', 'FDEKit Test');
    await git('add', '.');
    await git('commit', '-q', '-m', 'base');
    // billing.ts is imported by app.ts (fan-in 1); README has churn but no fan-in.
    await writeFile(path.join(rootDir, 'src', 'billing.ts'), [
      'export interface Invoice {',
      '  id: string;',
      '  total: number;',
      '  currency: string;',
      '}',
      'export function syncBilling(): boolean {',
      '  return true;',
      '}',
    ].join('\n'), 'utf8');
    await writeFile(path.join(rootDir, 'README.md'), '# Demo\nMore words.\n', 'utf8');
    await git('commit', '-aqm', 'change');

    const connector = codebaseConnector({ rootDir });
    const rankDiff = connector.tools?.find((tool) => tool.name === 'codebase.rankDiff');

    const result = await rankDiff?.handler({ base: 'HEAD~1' }, {}) as {
      totalChanged: number;
      files: Array<{ filePath: string; fanIn: number; score: number }>;
    };

    expect(result.totalChanged).toBe(2);
    expect(result.files[0]).toMatchObject({ filePath: 'src/billing.ts', fanIn: 1 });
    expect(result.files[0].score).toBeGreaterThan(result.files[1].score);

    await expect(rankDiff?.handler({ base: '' }, {})).rejects.toThrow('non-empty base ref');
  });

  it('reports navigation readiness for tree-sitter, ripgrep, and the symbol index', async () => {
    const rootDir = await writeNavFixture();
    const projectDir = await mkdtemp(path.join(tmpdir(), 'fdekit-project-'));
    const connector = codebaseConnector({ rootDir, env: { FDEKIT_PROJECT_DIR: projectDir } });

    const checks = await connector.readiness?.() ?? [];
    const byName = Object.fromEntries(checks.map((check) => [check.name, check]));

    expect(byName['tree-sitter']).toMatchObject({ ok: true });
    expect(byName['tree-sitter'].message).toContain('grammars loaded');
    expect(byName['ripgrep'].ok).toBe(true);
    expect(byName['symbol-index']).toMatchObject({ ok: true });
    // Index not built yet for this fresh project.
    expect(byName['symbol-index'].message).toContain('not built yet');

    // After a navigation call the index is cached and readiness reflects it.
    const symbols = connector.tools?.find((tool) => tool.name === 'codebase.symbols');
    await symbols?.handler({}, {});
    const afterChecks = await connector.readiness?.() ?? [];
    const afterIndex = afterChecks.find((check) => check.name === 'symbol-index');
    expect(afterIndex?.message).toMatch(/cached \d+ file/);
  });

  it('persists the symbol index under the project artifacts directory when FDEKIT_PROJECT_DIR is set', async () => {
    const rootDir = await writeNavFixture();
    const projectDir = await mkdtemp(path.join(tmpdir(), 'fdekit-project-'));
    const connector = codebaseConnector({ rootDir, env: { FDEKIT_PROJECT_DIR: projectDir } });
    const symbols = connector.tools?.find((tool) => tool.name === 'codebase.symbols');

    await symbols?.handler({}, {});

    const cacheEntries = await readdir(path.join(projectDir, 'artifacts', 'cache'));
    expect(cacheEntries.some((entry) => /^codebase-symbols-[0-9a-f]{12}\.json$/.test(entry))).toBe(true);
  });
});

async function writeNavFixture(): Promise<string> {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-codebase-'));
  await mkdir(path.join(rootDir, 'src'), { recursive: true });
  await writeFile(path.join(rootDir, 'src', 'billing.ts'), [
    'export interface Invoice {',
    '  id: string;',
    '}',
    'export function syncBilling(): boolean {',
    '  return true;',
    '}',
  ].join('\n'), 'utf8');
  await writeFile(path.join(rootDir, 'src', 'app.ts'), [
    "import { syncBilling } from './billing.js';",
    '',
    'export function renderApp(): boolean {',
    '  return syncBilling();',
    '}',
  ].join('\n'), 'utf8');

  return rootDir;
}
