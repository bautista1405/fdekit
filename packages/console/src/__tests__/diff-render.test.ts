import { describe, expect, it } from 'vitest';
import type { ReviewFinding } from '@fdekit/core';
import { filePathFromPatch, renderAnnotatedDiff, splitPatchFiles } from '../diff/render.js';

function filePatch(name: string, added = 'export const added = 2;'): string {
  return `diff --git a/${name} b/${name}
index 1111111..2222222 100644
--- a/${name}
+++ b/${name}
@@ -1,1 +1,2 @@
 export const existing = 1;
+${added}
`;
}

function finding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    file: 'src/a.ts',
    line: 2,
    severity: 'high',
    category: 'bug',
    confidence: 0.9,
    rationale: 'undefined identifier',
    evidence: ['src/a.ts:2'],
    ...overrides,
  };
}

describe('splitPatchFiles', () => {
  it('splits a multi-file patch into one entry per file', () => {
    const parts = splitPatchFiles(filePatch('src/a.ts') + filePatch('src/b.ts') + filePatch('src/c.ts'));

    expect(parts).toHaveLength(3);
    expect(parts[0]).toContain('src/a.ts');
    expect(parts[1]).toContain('src/b.ts');
    expect(parts[2]).toContain('src/c.ts');
  });

  it('returns an empty list for a blank patch', () => {
    expect(splitPatchFiles('')).toEqual([]);
    expect(splitPatchFiles('   \n ')).toEqual([]);
  });
});

describe('filePathFromPatch', () => {
  it('reads the post-image path from the git header', () => {
    expect(filePathFromPatch(filePatch('src/deep/name.ts'))).toBe('src/deep/name.ts');
  });

  it('handles a rename, preferring the new path', () => {
    const renamed = `diff --git a/src/old.ts b/src/new.ts
--- a/src/old.ts
+++ b/src/new.ts
@@ -1,1 +1,1 @@
-const a = 1;
+const a = 2;
`;

    expect(filePathFromPatch(renamed)).toBe('src/new.ts');
  });

  it('falls back to the +++ header when there is no git header', () => {
    const bare = `--- a/src/bare.ts
+++ b/src/bare.ts
@@ -1,1 +1,2 @@
 const a = 1;
+const b = 2;
`;

    expect(filePathFromPatch(bare)).toBe('src/bare.ts');
  });

  it('returns an empty string when no path is present', () => {
    expect(filePathFromPatch('not a patch')).toBe('');
  });
});

describe('renderAnnotatedDiff', () => {
  it('renders every file of a multi-file patch', async () => {
    const result = await renderAnnotatedDiff({
      patch: filePatch('src/a.ts') + filePatch('src/b.ts'),
    });

    expect(result.files.map((file) => file.filePath)).toEqual(['src/a.ts', 'src/b.ts']);
    expect(result.totalFiles).toBe(2);
    expect(result.truncated).toBe(false);
    result.files.forEach((file) => {
      expect(file.error).toBeUndefined();
      expect(file.html).toContain('existing');
    });
  });

  it('hoists the shared sprite and CSS once instead of repeating them per file', async () => {
    const result = await renderAnnotatedDiff({
      patch: filePatch('src/a.ts') + filePatch('src/b.ts') + filePatch('src/c.ts'),
    });

    // The shared assets must be present exactly once, outside the per-file HTML.
    expect(result.assets).toContain('data-icon-sprite');
    expect(result.assets).toContain('<style');

    result.files.forEach((file) => {
      expect(file.html).not.toContain('data-icon-sprite');
      expect(file.html).not.toContain('<style');
    });

    // Guards the property that motivates the hoist: per-file payload stays small,
    // so a large review does not turn console.html into a multi-megabyte file.
    const perFile = Math.max(...result.files.map((file) => file.html.length));
    expect(perFile).toBeLessThan(result.assets.length);
    expect(perFile).toBeLessThan(20_000);
  });

  it('rewrites shadow-DOM selectors so the stylesheet applies in the light DOM', async () => {
    const result = await renderAnnotatedDiff({ patch: filePatch('src/a.ts') });

    // The library styles its components for Shadow DOM, but its SSR output is
    // plain markup we inline into a normal page. Left as `:host`, the rules
    // defining --diffs-font-fallback and the theme palette match nothing, and
    // the diff silently renders in the host page's body font with no colors.
    expect(result.assets).not.toContain(':host');
    expect(result.assets).toContain(':root');
    expect(result.assets).toContain('--diffs-font-fallback');

    // Host declarations such as font-size, display, background, and color must
    // stay on the diff wrapper. Putting them on :root changes every rem and
    // inherited color/font on a page that embeds a review.
    expect(result.assets).toMatch(/\.fdekit-diff(?:\s+[^,{]+)?\{[^}]*(?:font-family|font-size|background-color|color|display):/);

    const rootRules = [...result.assets.matchAll(/:root(?:\s+[^,{]+)?\{([^}]*)\}/g)];
    expect(rootRules.length).toBeGreaterThan(0);

    for (const [, body] of rootRules) {
      const declarations = body
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean);

      expect(declarations.every((entry) => entry.startsWith('--'))).toBe(true);
    }
  });

  it('anchors findings to their own file', async () => {
    const result = await renderAnnotatedDiff({
      patch: filePatch('src/a.ts') + filePatch('src/b.ts'),
      findings: [finding({ file: 'src/a.ts' }), finding({ file: 'src/b.ts', line: 2 }), finding({ file: 'src/a.ts' })],
    });

    expect(result.files[0].findings).toHaveLength(2);
    expect(result.files[1].findings).toHaveLength(1);
    // The renderer emits an annotation slot; the console fills it (T1: finding
    // text is rendered by our own escaped markup, never inlined by the library).
    expect(result.files[0].html).toContain('data-line-annotation');
  });

  it('ignores findings whose file is not in the patch', async () => {
    const result = await renderAnnotatedDiff({
      patch: filePatch('src/a.ts'),
      findings: [finding({ file: 'src/not-in-diff.ts' })],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].findings).toEqual([]);
  });

  it('caps rendered files and reports the truncation', async () => {
    const result = await renderAnnotatedDiff({
      patch: filePatch('src/a.ts') + filePatch('src/b.ts') + filePatch('src/c.ts'),
      maxFiles: 2,
    });

    expect(result.files).toHaveLength(2);
    expect(result.totalFiles).toBe(3);
    expect(result.truncated).toBe(true);
  });

  it('isolates an unparseable segment instead of failing the whole render', async () => {
    // Content before the first `diff --git` has no file diff, which the
    // renderer rejects. The valid file after it must still render.
    const result = await renderAnnotatedDiff({
      patch: `stray preamble the renderer cannot parse\n${filePatch('src/a.ts')}`,
    });

    expect(result.files).toHaveLength(2);

    const broken = result.files[0];
    expect(broken.error).toBeTruthy();
    expect(broken.html).toBe('');

    const good = result.files[1];
    expect(good.filePath).toBe('src/a.ts');
    expect(good.error).toBeUndefined();
    expect(good.html).toContain('existing');
  });

  it('neutralizes a hostile patch (T1: diff content is attacker-controlled)', async () => {
    const hostile = `diff --git a/x.ts b/x.ts
index 1111111..2222222 100644
--- a/x.ts
+++ b/x.ts
@@ -1,1 +1,5 @@
 const ok = 1;
+const evil = "</script><script>alert('xss')</script>";
+// <img src=x onerror=alert(1)>
+const link = "<a href='javascript:alert(2)'>x</a>";
+const style = "</style><style>body{display:none}</style>";
`;

    const result = await renderAnnotatedDiff({ patch: hostile });
    const html = result.files[0].html;

    // Text nodes legitimately contain the literal characters; what must not
    // exist is a LIVE tag or handler. Strip text nodes, then assert on markup.
    const markupOnly = html.replace(/>[^<]*</g, '><');

    expect(markupOnly).not.toMatch(/<script(\s|>)/i);
    expect(markupOnly).not.toMatch(/<style(\s|>)/i);
    // Event handlers only: `\s` anchors to an attribute boundary so legitimate
    // attributes containing "on" (data-line-number-content=) do not false-positive.
    expect(markupOnly).not.toMatch(/\son[a-z]+\s*=/i);
    expect(markupOnly).not.toMatch(/(href|src)\s*=\s*["']?javascript:/i);

    // The dangerous characters survive as escaped text, so the reviewer still
    // sees what the diff actually says.
    expect(html).toContain('&#x3C;');
    expect(html).toContain('onerror');
  });

  it('does not inline finding text into library output', async () => {
    const result = await renderAnnotatedDiff({
      patch: filePatch('src/a.ts'),
      findings: [finding({ rationale: '<script>alert("finding")</script>UNIQUEMARKER' })],
    });

    // Confirms the contract this module documents: the library anchors the
    // line, the console renders the finding body through its own escaping.
    expect(result.files[0].html).not.toContain('UNIQUEMARKER');
  });
});
