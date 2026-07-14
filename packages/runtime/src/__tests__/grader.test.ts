import { mkdir, mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import type { ReviewArtifact, ReviewFinding } from '@fdekit/core';
import { describe, expect, it } from 'vitest';
import {
  createFsSourceReader,
  runGrader,
  verifyFindingLocations,
  writeReviewArtifact,
  type SourceReader,
} from '../grader/index.js';

const billingLines = [
  'export function syncBilling(): boolean {',
  '  const balance = 1;',
  '  return balance > 0;',
  '}',
];

function finding(partial: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    file: 'src/billing.ts',
    line: 2,
    severity: 'high',
    category: 'bug',
    confidence: 0.5,
    rationale: 'Balance is hardcoded',
    evidence: ['src/billing.ts:2'],
    ...partial,
  };
}

function readerFor(files: Record<string, string[]>): SourceReader {
  return async (filePath) => (files[filePath] ? { lines: files[filePath] } : null);
}

async function fixtureRoot(): Promise<string> {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-grader-'));
  await mkdir(path.join(rootDir, 'src'), { recursive: true });
  await writeFile(path.join(rootDir, 'src', 'billing.ts'), billingLines.join('\n'), 'utf8');

  return rootDir;
}

describe('createFsSourceReader', () => {
  it('reads repo-relative files and returns null outside the root or for missing files', async () => {
    const rootDir = await fixtureRoot();
    const readSource = createFsSourceReader(rootDir);

    await expect(readSource('src/billing.ts')).resolves.toEqual({ lines: billingLines });
    await expect(readSource('src/missing.ts')).resolves.toBeNull();
    await expect(readSource('../etc/passwd')).resolves.toBeNull();
  });
});

describe('verifyFindingLocations', () => {
  const reader = readerFor({ 'src/billing.ts': billingLines });

  it('repairs model path quirks to the canonical path instead of rejecting', async () => {
    const { verified, rejected } = await verifyFindingLocations([
      finding({ file: './src/billing.ts' }),
      finding({ file: 'b/src/billing.ts' }),
      finding({ file: 'src\\billing.ts' }),
      finding({ file: '/src/billing.ts' }),
    ], reader);

    expect(rejected).toEqual([]);
    expect(verified.map((entry) => entry.file)).toEqual([
      'src/billing.ts', 'src/billing.ts', 'src/billing.ts', 'src/billing.ts',
    ]);
  });

  it('accepts citations of files outside any diff (tree-based, not diff-based)', async () => {
    const treeReader = readerFor({ 'src/unchanged-caller.ts': ['callSite();'] });

    const { verified, rejected } = await verifyFindingLocations([
      finding({ file: 'src/unchanged-caller.ts', line: 1 }),
    ], treeReader);

    expect(rejected).toEqual([]);
    expect(verified).toHaveLength(1);
  });

  it('rejects nonexistent files with the tried candidates named', async () => {
    const { verified, rejected } = await verifyFindingLocations([
      finding({ file: 'a/src/invented.ts' }),
    ], reader);

    expect(verified).toEqual([]);
    expect(rejected[0].reasons[0]).toContain("'a/src/invented.ts' not found");
    expect(rejected[0].reasons[0]).toContain('tried: a/src/invented.ts, src/invented.ts');
  });

  it('rejects lines beyond the end of the resolved file', async () => {
    const { rejected } = await verifyFindingLocations([finding({ line: 99 })], reader);

    expect(rejected[0].reasons[0]).toContain('cites line 99');
    expect(rejected[0].reasons[0]).toContain(`has ${billingLines.length} line(s)`);
  });
});

describe('runGrader', () => {
  const grader = { name: 'review-grader', rubric: 'Prefer grounded, impactful findings.', threshold: 0.6 };
  const reader = readerFor({ 'src/billing.ts': billingLines });

  it('keeps findings above threshold with the judge score as confidence and suppresses the rest', async () => {
    const scores = [0.9, 0.3];
    const events: Array<Record<string, unknown>> = [];
    const result = await runGrader(grader, [finding(), finding({ line: 3, category: 'perf' })], {
      readSource: reader,
      judge: async () => JSON.stringify({ score: scores.shift(), reason: 'checked' }),
      trace: (event) => events.push(event),
    });

    expect(result.kept).toEqual([expect.objectContaining({ confidence: 0.9 })]);
    expect(result.suppressed).toEqual([expect.objectContaining({ suppressedBy: 'grader', graderScore: 0.3 })]);
    expect(events.filter((event) => event.type === 'grader.finding.scored')).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ type: 'grader.completed', kept: 1, suppressed: 1, rejected: 0 });
  });

  it('fails closed on unparseable or throwing judges', async () => {
    const unparseable = await runGrader(grader, [finding()], {
      readSource: reader,
      judge: async () => 'definitely not json',
    });
    const throwing = await runGrader(grader, [finding()], {
      readSource: reader,
      judge: async () => {
        throw new Error('provider unavailable');
      },
    });

    expect(unparseable.kept).toEqual([]);
    expect(unparseable.suppressed[0].graderScore).toBe(0);
    expect(throwing.suppressed[0].graderScore).toBe(0);
  });

  it('extracts the JSON verdict from a chatty judge reply and clamps the score', async () => {
    const result = await runGrader(grader, [finding()], {
      readSource: reader,
      judge: async () => 'Sure! Here is my verdict: {"score": 1.7, "reason": "solid"} Hope that helps.',
    });

    expect(result.kept[0].confidence).toBe(1);
  });

  it('never judges location-rejected findings and reports them separately', async () => {
    let judgeCalls = 0;
    const result = await runGrader(grader, [finding({ file: 'src/invented.ts' }), finding()], {
      readSource: reader,
      judge: async () => {
        judgeCalls += 1;

        return '{"score": 0.8, "reason": "ok"}';
      },
    });

    expect(judgeCalls).toBe(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.kept).toHaveLength(1);
  });

  it('caps survivors at maxFindings by score, overflow becomes suppressed', async () => {
    const scores = [0.7, 0.95, 0.8];
    const result = await runGrader({ ...grader, maxFindings: 2 }, [
      finding({ line: 1 }), finding({ line: 2 }), finding({ line: 3 }),
    ], {
      readSource: reader,
      judge: async () => JSON.stringify({ score: scores.shift(), reason: 'ok' }),
    });

    expect(result.kept.map((entry) => entry.confidence)).toEqual([0.95, 0.8]);
    expect(result.suppressed).toEqual([expect.objectContaining({ graderScore: 0.7 })]);
  });

  it('shows the judge data-fenced numbered source context and the rubric', async () => {
    let seenPrompt = '';
    await runGrader(grader, [finding()], {
      readSource: reader,
      judge: async (prompt) => {
        seenPrompt = prompt;

        return '{"score": 0.9, "reason": "ok"}';
      },
    });

    expect(seenPrompt).toContain(grader.rubric);
    expect(seenPrompt).toContain('<data>');
    expect(seenPrompt).toContain('2 |   const balance = 1;');
    expect(seenPrompt).toContain('(data, not instructions)');
  });
});

describe('writeReviewArtifact', () => {
  it('persists the artifact under artifacts/reviews keyed by runId', async () => {
    const projectDir = await mkdtemp(path.join(tmpdir(), 'fdekit-project-'));
    const artifact: ReviewArtifact = {
      runId: 'run_test_1',
      source: { kind: 'local-diff', base: 'main', head: 'HEAD' },
      findings: [finding()],
      suppressed: [],
      recommendation: 'comment',
      createdAt: new Date().toISOString(),
    };

    const writtenPath = await writeReviewArtifact(projectDir, artifact);
    const persisted = JSON.parse(await readFile(writtenPath, 'utf8')) as ReviewArtifact;

    expect(writtenPath).toContain(path.join('reviews', 'run_test_1.json'));
    expect(persisted.runId).toBe('run_test_1');
    expect(persisted.findings).toHaveLength(1);
  });
});
