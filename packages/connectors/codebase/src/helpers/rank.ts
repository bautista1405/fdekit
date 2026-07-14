import type { CodebaseDiffFile, CodebaseRankedFile, CodebaseSymbolIndex } from '../interfaces/index.js';
import { findImporters } from './symbol-index.js';

const sensitivePath = /auth|payment|billing|secur|migrat/i;

/**
 * Ranks changed files by review risk: churn (added + deleted lines) weighted by
 * fan-in (how many files import the changed file, from the symbol index). The
 * ranking drives the review flow's context budget and the reviewer triage card.
 */
export function rankDiffFiles(files: CodebaseDiffFile[], index: CodebaseSymbolIndex): CodebaseRankedFile[] {
  return files
    .map((file) => {
      const churn = file.additions + file.deletions;
      const fanIn = findImporters(index, file.filePath).length;
      const reasons = [
        churn > 200 ? 'large change' : '',
        fanIn > 5 ? `high fan-in (${fanIn} importers)` : '',
        file.status === 'deleted' && fanIn > 0 ? `deleted but still imported by ${fanIn} file(s)` : '',
        sensitivePath.test(file.filePath) ? 'sensitive path' : '',
      ].filter(Boolean);

      return {
        filePath: file.filePath,
        status: file.status,
        churn,
        fanIn,
        score: churn * Math.max(1, fanIn),
        reasons,
      };
    })
    .sort((left, right) => right.score - left.score);
}
