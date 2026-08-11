import type { ConsoleData } from '../interfaces/index.js';
import { renderAnnotatedDiff, type RenderedDiff } from './render.js';

/**
 * Prerendered diffs, keyed by run id.
 *
 * This type exists to solve one specific problem. Rendering an annotated diff
 * is asynchronous (`@pierre/diffs` tokenizes with shiki), but every console
 * section renderer is a synchronous string builder and making them async would
 * ripple through the whole package and its public API.
 *
 * So the async work happens once, up front, in `prepareConsoleDiffs`. The
 * result is passed into the sync pipeline, which only ever reads from it.
 */
export interface PreparedConsoleDiffs {
  /**
   * Icon sprite + theme CSS shared by every rendered diff, emitted ONCE per
   * page. Roughly 48KB; inlining it per file would add ~1MB to a 20-file
   * review and break the single-emailable-file property (ADR-0004).
   */
  assets: string;
  /** Rendered diff per run id. Absent when a review had no captured patch. */
  byRunId: Record<string, RenderedDiff>;
}

export interface PrepareConsoleDiffsOptions {
  /** Cap on files rendered per review. Defaults to the renderer's own cap. */
  maxFilesPerReview?: number;
  /** Long-line behaviour; see `RenderAnnotatedDiffOptions.overflow`. */
  overflow?: 'scroll' | 'wrap';
  /** Side-by-side or stacked; see `RenderAnnotatedDiffOptions.diffStyle`. */
  diffStyle?: 'unified' | 'split';
}

export const emptyPreparedDiffs: PreparedConsoleDiffs = { assets: '', byRunId: {} };

/**
 * Renders every review's diff ahead of the synchronous console pass.
 *
 * Call this before `renderConsolePages` and hand the result in:
 *
 * ```ts
 * const diffs = await prepareConsoleDiffs(consoleData);
 * const pages = renderConsolePages(consoleData, { diffs });
 * ```
 *
 * Reviews without a captured patch are skipped rather than failing: the console
 * degrades to findings-without-code-context, which is still useful evidence.
 */
export async function prepareConsoleDiffs(
  data: ConsoleData,
  options: PrepareConsoleDiffsOptions = {},
): Promise<PreparedConsoleDiffs> {
  const reviews = data.reviews ?? [];
  const byRunId: Record<string, RenderedDiff> = {};
  let assets = '';

  for (const review of reviews) {
    const patch = review.patch;

    if (!patch || !patch.trim()) {
      continue;
    }

    const rendered = await renderAnnotatedDiff({
      patch,
      findings: review.artifact.findings ?? [],
      maxFiles: options.maxFilesPerReview,
      overflow: options.overflow,
      diffStyle: options.diffStyle,
    });

    // Every render emits the same assets; keep the first non-empty copy only.
    if (!assets && rendered.assets) {
      assets = rendered.assets;
    }

    byRunId[review.artifact.runId] = { ...rendered, assets: '' };
  }

  return { assets, byRunId };
}
