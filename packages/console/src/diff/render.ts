import { preloadPatchDiff } from '@pierre/diffs/ssr';
import type { ReviewFinding } from '@fdekit/core';

/**
 * The single point where `@pierre/diffs` is imported. Nothing else in the
 * console may import it directly: the library is pinned exactly and moves
 * fast, so a breaking change stays a one-file fix (R10b).
 *
 * Three properties of the library shape this module, all verified against
 * 1.3.2 rather than assumed:
 *
 * 1. `preloadPatchDiff` accepts EXACTLY ONE file diff and throws otherwise,
 *    so a pull-request patch is split here (`parsePatchFiles` does not do it).
 * 2. Every call re-emits ~48KB of byte-identical icon-sprite and theme CSS.
 *    Inlined per file that would add ~1MB to a 20-file review and destroy the
 *    "console.html is one emailable file" property (ADR-0004), so the shared
 *    assets are extracted once into `assets` and stripped from each file.
 * 3. Annotations anchor a line but DO NOT render their own content: SSR emits
 *    empty slots (`data-line-annotation`, `data-annotation-content`). Finding
 *    text is therefore rendered by the console's own escaped markup, which is
 *    also what keeps attacker-controlled text inside our escaping (T1).
 */

/** Diff for one file, with the shared sprite/CSS removed. */
export interface RenderedDiffFile {
  filePath: string;
  /** Prerendered diff body. Safe to inline: diff content is escaped by the renderer. */
  html: string;
  /** Findings anchored into this file, in the order they were supplied. */
  findings: ReviewFinding[];
  /** Set when this file's patch could not be rendered; `html` is then empty. */
  error?: string;
}

export interface RenderedDiff {
  /**
   * Icon sprite + theme CSS, emitted ONCE per page before any file. Empty when
   * no file rendered successfully.
   */
  assets: string;
  files: RenderedDiffFile[];
  /** True when `maxFiles` capped the output; the console must say so. */
  truncated: boolean;
  /** Files present in the patch, before capping. */
  totalFiles: number;
}

export interface RenderAnnotatedDiffOptions {
  /** Unified diff. May contain many files (a whole PR). */
  patch: string;
  /** Findings to anchor. Matched to files by `finding.file`. */
  findings?: ReviewFinding[];
  /**
   * Cap on rendered files (budgeter discipline: oversized reviews degrade
   * gracefully and say so rather than blowing up the artifact). Default 50.
   */
  maxFiles?: number;
  /**
   * Long-line behaviour. Defaults to `scroll`, matching every mainstream diff
   * viewer and Pierre's own DiffsHub.
   *
   * `scroll` is right for reading code: it keeps indentation and column
   * alignment intact, keeps line numbers one-to-one with visual rows, and is
   * the only option that works in split view, where two sides must stay
   * aligned. `wrap` trades all of that away to guarantee nothing is off-screen
   * — worth it only when the output cannot be scrolled at all, which is
   * exactly the printed/PDF case (see the print rule in the console styles).
   */
  overflow?: 'scroll' | 'wrap';
  /**
   * `split` shows before and after side by side; `unified` stacks them in one
   * column. Defaults to `split`, which is what a reviewer expects and what
   * DiffsHub uses at desktop widths. Prefer `unified` in narrow containers —
   * below roughly 900px each side of a split is too thin to read.
   */
  diffStyle?: 'unified' | 'split';
}

const DEFAULT_MAX_FILES = 50;
const SPRITE_PATTERN = /<svg data-icon-sprite[\s\S]*?<\/svg>/;
const STYLE_PATTERN = /<style[\s\S]*?<\/style>/g;

/**
 * Splits a multi-file unified diff into one patch string per file.
 *
 * `parsePatchFiles` from the library returns the whole patch as a single entry,
 * so the split is ours. Exported for tests.
 */
export function splitPatchFiles(patch: string): string[] {
  if (!patch.trim()) {
    return [];
  }

  return patch.split(/(?=^diff --git )/m).filter((part) => part.trim().length > 0);
}

/**
 * Reads the post-image path from a single-file patch: `diff --git a/x b/y`
 * yields `y`, falling back to the `+++ b/y` header for patches without a
 * `diff --git` line. Returns an empty string when neither is present.
 */
export function filePathFromPatch(filePatch: string): string {
  const gitHeader = /^diff --git a\/(.+?) b\/(.+)$/m.exec(filePatch);

  if (gitHeader) {
    return gitHeader[2].trim();
  }

  const plusHeader = /^\+\+\+ (?:b\/)?(.+)$/m.exec(filePatch);

  if (plusHeader) {
    const path = plusHeader[1].trim();

    return path === '/dev/null' ? '' : path;
  }

  return '';
}

/**
 * Renders a unified diff with findings anchored to their lines.
 *
 * Never throws for content reasons: a file whose patch the renderer rejects is
 * returned with an `error` and empty `html` so one malformed file cannot take
 * down the whole console render.
 */
export async function renderAnnotatedDiff(options: RenderAnnotatedDiffOptions): Promise<RenderedDiff> {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const allPatches = splitPatchFiles(options.patch);
  const patches = allPatches.slice(0, Math.max(0, maxFiles));
  const findingsByFile = groupFindingsByFile(options.findings ?? []);

  const files: RenderedDiffFile[] = [];
  let assets = '';

  for (const filePatch of patches) {
    const filePath = filePathFromPatch(filePatch);
    const findings = findingsByFile.get(filePath) ?? [];

    try {
      const { prerenderedHTML } = await preloadPatchDiff<ReviewFinding>({
        patch: filePatch,
        options: {
          overflow: options.overflow ?? 'scroll',
          diffStyle: options.diffStyle ?? 'split',
        },
        annotations: findings.map((finding) => ({
          side: 'additions' as const,
          lineNumber: finding.line,
          metadata: finding,
        })),
      });

      if (!assets) {
        assets = extractAssets(prerenderedHTML);
      }

      files.push({ filePath, html: stripAssets(prerenderedHTML), findings });
    } catch (error) {
      files.push({
        filePath,
        html: '',
        findings,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    assets,
    files,
    truncated: allPatches.length > patches.length,
    totalFiles: allPatches.length,
  };
}

function groupFindingsByFile(findings: ReviewFinding[]): Map<string, ReviewFinding[]> {
  const grouped = new Map<string, ReviewFinding[]>();

  for (const finding of findings) {
    const existing = grouped.get(finding.file);

    if (existing) {
      existing.push(finding);
    } else {
      grouped.set(finding.file, [finding]);
    }
  }

  return grouped;
}

function extractAssets(html: string): string {
  const sprite = SPRITE_PATTERN.exec(html)?.[0] ?? '';
  const styles = (html.match(STYLE_PATTERN) ?? []).map(unshadowCss).join('');

  return `${sprite}${styles}`;
}

/**
 * Rewrites `:host` to `:root` so the diff stylesheet works in the light DOM.
 *
 * `@pierre/diffs` styles its components for Shadow DOM, but its SSR output is
 * plain markup with no custom element, and we inline it directly into a page.
 * `:host` therefore matches nothing, and the three rules that use it are the
 * ones that define everything that matters: `--diffs-font-fallback` (the
 * monospace stack), the header font, the scrollbar gutter, and the whole theme
 * palette. Without this rewrite the diff renders in the page's body font with
 * no theme — which is exactly what it looked like before this existed.
 *
 * `:root` is safe here: every variable these rules declare is `--diffs-`
 * prefixed, so nothing can collide with the host page.
 */
function unshadowCss(styleBlock: string): string {
  return styleBlock.replace(/:host(?![-(\w])/g, ':root');
}

function stripAssets(html: string): string {
  return html.replace(SPRITE_PATTERN, '').replace(STYLE_PATTERN, '');
}
