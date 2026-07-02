import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { isIndexableSourceFile, loadOrBuildSymbolIndex, symbolIndexCachePath } from '../helpers/symbol-index.js';

const ignore = ['node_modules', '.git'];
const maxFileBytes = 80_000;

async function writeFixture(rootDir: string): Promise<void> {
  await mkdir(path.join(rootDir, 'src'), { recursive: true });
  await writeFile(path.join(rootDir, 'src', 'billing.ts'), [
    "import { helper } from './helper.js';",
    '',
    'export interface Invoice {',
    '  id: string;',
    '}',
    '',
    'export type InvoiceStatus = string;',
    '',
    'export const INVOICE_LIMIT = 10;',
    '',
    'export function syncBilling(): boolean {',
    '  const local = helper();',
    '  return local;',
    '}',
    '',
    'class BillingService {',
    '  charge(): number {',
    '    return 1;',
    '  }',
    '}',
  ].join('\n'), 'utf8');
  await writeFile(path.join(rootDir, 'src', 'helper.js'), [
    'export function helper() {',
    '  return true;',
    '}',
  ].join('\n'), 'utf8');
  await writeFile(path.join(rootDir, 'README.md'), '# Demo\n', 'utf8');
}

describe('symbol index', () => {
  it('recognizes indexable source files by extension', () => {
    expect(isIndexableSourceFile('src/app.ts')).toBe(true);
    expect(isIndexableSourceFile('src/app.tsx')).toBe(true);
    expect(isIndexableSourceFile('src/app.mjs')).toBe(true);
    expect(isIndexableSourceFile('README.md')).toBe(false);
    expect(isIndexableSourceFile('assets/logo.png')).toBe(false);
  });

  it('indexes typescript and javascript declarations with kinds and export flags', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-symbols-'));
    await writeFixture(rootDir);

    const index = await loadOrBuildSymbolIndex({ root: rootDir, ignore, maxFileBytes });

    expect(Object.keys(index.files).sort()).toEqual(['src/billing.ts', 'src/helper.js']);

    const billing = index.files['src/billing.ts'];
    const names = billing.symbols.map((symbol) => `${symbol.kind}:${symbol.name}:${symbol.exported}`);

    expect(names).toContain('interface:Invoice:true');
    expect(names).toContain('type:InvoiceStatus:true');
    expect(names).toContain('const:INVOICE_LIMIT:true');
    expect(names).toContain('function:syncBilling:true');
    expect(names).toContain('class:BillingService:false');
    expect(names).toContain('method:charge:false');
    expect(billing.symbols.find((symbol) => symbol.name === 'local')).toBeUndefined();
    expect(billing.imports).toContain('./helper.js');

    const invoice = billing.symbols.find((symbol) => symbol.name === 'Invoice');
    expect(invoice).toMatchObject({ filePath: 'src/billing.ts', startLine: 3, endLine: 5 });

    expect(index.files['src/helper.js'].symbols).toContainEqual(
      expect.objectContaining({ kind: 'function', name: 'helper', exported: true }),
    );
  });

  it('skips reparsing unchanged files and evicts deleted files', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-symbols-'));
    await writeFixture(rootDir);
    const billingPath = path.join(rootDir, 'src', 'billing.ts');
    const staleDate = new Date(Date.now() - 60_000);

    await utimes(billingPath, staleDate, staleDate);
    await loadOrBuildSymbolIndex({ root: rootDir, ignore, maxFileBytes });

    await writeFile(billingPath, 'export function replaced(): number { return 1; }\n', 'utf8');
    await utimes(billingPath, staleDate, staleDate);
    const unchangedMtime = await loadOrBuildSymbolIndex({ root: rootDir, ignore, maxFileBytes });

    expect(unchangedMtime.files['src/billing.ts'].symbols.map((symbol) => symbol.name)).toContain('syncBilling');
    expect(unchangedMtime.files['src/billing.ts'].symbols.map((symbol) => symbol.name)).not.toContain('replaced');

    await utimes(billingPath, new Date(), new Date());
    const changedMtime = await loadOrBuildSymbolIndex({ root: rootDir, ignore, maxFileBytes });

    expect(changedMtime.files['src/billing.ts'].symbols.map((symbol) => symbol.name)).toContain('replaced');

    await rm(path.join(rootDir, 'src', 'helper.js'));
    const afterDelete = await loadOrBuildSymbolIndex({ root: rootDir, ignore, maxFileBytes });

    expect(afterDelete.files['src/helper.js']).toBeUndefined();
  });

  it('persists the index to the configured cache file path', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-symbols-'));
    await writeFixture(rootDir);
    const cacheFilePath = path.join(rootDir, 'cache', 'symbols.json');

    await loadOrBuildSymbolIndex({ root: rootDir, ignore, maxFileBytes, cacheFilePath });

    const persisted = JSON.parse(await readFile(cacheFilePath, 'utf8')) as { root: string; files: Record<string, unknown> };
    expect(persisted.root).toBe(rootDir);
    expect(persisted.files['src/billing.ts']).toBeDefined();
  });

  it('derives a per-root cache path under the project artifacts directory', () => {
    const cachePath = symbolIndexCachePath('/customer/app/fdekit', '/customer/app');

    expect(cachePath).toContain(path.join('artifacts', 'cache'));
    expect(cachePath).toMatch(/codebase-symbols-[0-9a-f]{12}\.json$/);
    expect(symbolIndexCachePath(undefined, '/customer/app')).toBeUndefined();
  });
});
