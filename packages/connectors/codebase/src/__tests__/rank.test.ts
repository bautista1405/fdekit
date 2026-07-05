import { describe, expect, it } from 'vitest';
import { rankDiffFiles } from '../helpers/rank.js';
import type { CodebaseDiffFile, CodebaseSymbolIndex } from '../interfaces/index.js';

function diffFile(partial: Partial<CodebaseDiffFile> & { filePath: string }): CodebaseDiffFile {
  return {
    status: 'modified',
    additions: 0,
    deletions: 0,
    binary: false,
    patchTruncated: false,
    hunks: [],
    ...partial,
  };
}

function indexWith(files: Record<string, string[]>): CodebaseSymbolIndex {
  return {
    builtAt: new Date().toISOString(),
    root: '/repo',
    files: Object.fromEntries(Object.entries(files).map(([filePath, imports]) => [
      filePath,
      { mtimeMs: 1, symbols: [], imports },
    ])),
  };
}

describe('rankDiffFiles', () => {
  it('weights churn by fan-in and sorts by score', () => {
    const index = indexWith({
      'src/util.ts': [],
      'src/a.ts': ['./util.js'],
      'src/b.ts': ['./util.js'],
      'src/readme-only.ts': [],
    });
    const ranked = rankDiffFiles([
      diffFile({ filePath: 'README.md', additions: 30 }),          // churn 30, fanIn 0 → 30
      diffFile({ filePath: 'src/util.ts', additions: 10, deletions: 10 }), // churn 20, fanIn 2 → 40
    ], index);

    expect(ranked.map((file) => file.filePath)).toEqual(['src/util.ts', 'README.md']);
    expect(ranked[0]).toMatchObject({ churn: 20, fanIn: 2, score: 40 });
    expect(ranked[1]).toMatchObject({ churn: 30, fanIn: 0, score: 30 });
  });

  it('attaches human-readable risk reasons', () => {
    const importers = Object.fromEntries(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((name) => [`src/${name}.ts`, ['./hot.js']]),
    );
    const index = indexWith({ 'src/hot.ts': [], ...importers, 'src/gone.ts': [], 'src/uses-gone.ts': ['./gone.js'] });
    const ranked = rankDiffFiles([
      diffFile({ filePath: 'src/hot.ts', additions: 201 }),
      diffFile({ filePath: 'src/auth/login.ts', additions: 1 }),
      diffFile({ filePath: 'src/gone.ts', status: 'deleted', deletions: 5 }),
    ], index);
    const byPath = Object.fromEntries(ranked.map((file) => [file.filePath, file]));

    expect(byPath['src/hot.ts'].reasons).toEqual(['large change', 'high fan-in (6 importers)']);
    expect(byPath['src/auth/login.ts'].reasons).toEqual(['sensitive path']);
    expect(byPath['src/gone.ts'].reasons).toEqual(['deleted but still imported by 1 file(s)']);
  });

  it('scores binary and empty changes as zero risk', () => {
    const ranked = rankDiffFiles([
      diffFile({ filePath: 'logo.png', binary: true }),
    ], indexWith({}));

    expect(ranked[0]).toMatchObject({ score: 0, reasons: [] });
  });
});
