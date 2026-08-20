import { describe, expect, it } from 'vitest';
import type { DeploymentDefinition, ReviewArtifact } from '@fdekit/core';
import { prepareConsoleDiffs } from '../diff/prepare.js';
import { renderConsolePages } from '../html-shell/index.js';
import type { ConsoleData, ConsoleReview } from '../interfaces/index.js';

const deployment = { name: 'review-demo', environment: 'local' } as unknown as DeploymentDefinition;

function patchFor(name: string): string {
  return `diff --git a/${name} b/${name}
index 1111111..2222222 100644
--- a/${name}
+++ b/${name}
@@ -1,1 +1,2 @@
 export const existing = 1;
+export const added = 2;
`;
}

function review(runId: string, overrides: Partial<ReviewArtifact> = {}): ReviewArtifact {
  return {
    runId,
    source: { kind: 'github-pr', repository: 'acme/app', number: 1 },
    findings: [
      {
        file: 'src/a.ts',
        line: 2,
        severity: 'high',
        category: 'bug',
        confidence: 0.9,
        rationale: 'undefined identifier',
        evidence: ['src/a.ts:2'],
      },
    ],
    suppressed: [],
    recommendation: 'request-changes',
    createdAt: '2026-08-06T10:00:00.000Z',
    ...overrides,
  };
}

function consoleData(reviews: ConsoleReview[]): ConsoleData {
  return { deployment, traces: [], reviews };
}

describe('prepareConsoleDiffs', () => {
  it('renders a diff per review and hoists shared assets once', async () => {
    const prepared = await prepareConsoleDiffs(consoleData([
      { artifact: review('run-a'), patch: patchFor('src/a.ts') },
      { artifact: review('run-b'), patch: patchFor('src/b.ts') },
    ]));

    expect(Object.keys(prepared.byRunId).sort()).toEqual(['run-a', 'run-b']);
    expect(prepared.assets).toContain('data-icon-sprite');

    // The per-run payloads must NOT repeat the ~48KB sprite/CSS; that is the
    // whole reason the assets are hoisted.
    for (const rendered of Object.values(prepared.byRunId)) {
      expect(rendered.assets).toBe('');
      rendered.files.forEach((file) => {
        expect(file.html).not.toContain('data-icon-sprite');
        expect(file.html).not.toContain('<style');
      });
    }
  });

  it('skips reviews with no captured patch instead of failing', async () => {
    const prepared = await prepareConsoleDiffs(consoleData([
      { artifact: review('run-with'), patch: patchFor('src/a.ts') },
      { artifact: review('run-without'), patch: null },
      { artifact: review('run-blank'), patch: '   ' },
    ]));

    expect(Object.keys(prepared.byRunId)).toEqual(['run-with']);
  });

  it('returns empty output when there are no reviews', async () => {
    const prepared = await prepareConsoleDiffs(consoleData([]));

    expect(prepared).toEqual({ assets: '', byRunId: {} });
  });
});

describe('review page rendering', () => {
  it('renders findings and the diff on the reviews page', async () => {
    const data = consoleData([{ artifact: review('run-a'), patch: patchFor('src/a.ts') }]);
    const diffs = await prepareConsoleDiffs(data);
    const pages = renderConsolePages(data, { diffs });
    const reviewsPage = pages.find((page) => page.fileName === 'reviews.html');

    expect(reviewsPage).toBeDefined();
    expect(reviewsPage!.html).toContain('acme/app#1');
    expect(reviewsPage!.html).toContain('undefined identifier');
    expect(reviewsPage!.html).toContain('src/a.ts');
    // the prerendered diff body
    expect(reviewsPage!.html).toContain('data-line-annotation');
  });

  it('emits the diff assets only on the reviews page', async () => {
    const data = consoleData([{ artifact: review('run-a'), patch: patchFor('src/a.ts') }]);
    const diffs = await prepareConsoleDiffs(data);
    const pages = renderConsolePages(data, { diffs });

    const withSprite = pages.filter((page) => page.html.includes('data-icon-sprite'));

    expect(withSprite.map((page) => page.fileName)).toEqual(['reviews.html']);
  });

  it('degrades to findings-only when diffs were not prepared', async () => {
    const data = consoleData([{ artifact: review('run-a'), patch: patchFor('src/a.ts') }]);
    const pages = renderConsolePages(data);
    const reviewsPage = pages.find((page) => page.fileName === 'reviews.html');

    // The findings must still be present — losing them because the caller
    // skipped the async pass would be a silent evidence gap.
    expect(reviewsPage!.html).toContain('undefined identifier');
    expect(reviewsPage!.html).toContain('No diff was captured');
    expect(reviewsPage!.html).not.toContain('data-icon-sprite');
  });

  it('renders an empty state when the deployment has no reviews', () => {
    const pages = renderConsolePages(consoleData([]));
    const reviewsPage = pages.find((page) => page.fileName === 'reviews.html');

    expect(reviewsPage!.html).toContain('No review artifacts captured yet');
  });

  it('escapes model-authored finding text', async () => {
    const hostile = review('run-x', {
      findings: [
        {
          file: '<img src=x onerror=alert(1)>.ts',
          line: 2,
          severity: 'high',
          category: 'bug',
          confidence: 0.9,
          rationale: '<script>alert("rationale")</script>',
          suggestion: '<script>alert("suggestion")</script>',
          evidence: ['<script>alert("evidence")</script>'],
        },
      ],
    });
    const data = consoleData([{ artifact: hostile, patch: patchFor('src/a.ts') }]);
    const diffs = await prepareConsoleDiffs(data);
    const pages = renderConsolePages(data, { diffs });
    const html = pages.find((page) => page.fileName === 'reviews.html')!.html;

    // The console shell legitimately contains its own <script> for exports, so
    // assert on the *tags the findings would have injected*, not on any
    // occurrence of the substring. Escaped text keeping the literal characters
    // is correct and expected — the reviewer must still see what was written.
    expect(html).not.toContain('<script>alert(');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x');
  });
});
