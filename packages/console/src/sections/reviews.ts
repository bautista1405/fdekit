import type { ReviewArtifact, ReviewFinding } from '@fdekit/core';
import type { ConsoleReview } from '../interfaces/index.js';
import { escapeHtml } from '../view-models/index.js';
import type { RenderedDiffFile } from '../diff/render.js';
import type { PreparedConsoleDiffs } from '../diff/prepare.js';
import type { DashboardSectionStrategy } from './types.js';

/**
 * Code review evidence: findings anchored to the diff the agent actually read.
 *
 * Everything here is synchronous. The diffs were rendered ahead of time by
 * `prepareConsoleDiffs` and arrive through the section context; this file only
 * inlines strings that already exist.
 *
 * Trust boundary: diff HTML comes from `@pierre/diffs`, which escapes patch
 * content (verified by the hostile-patch test in `diff-render.test.ts`), so it
 * is inlined as-is. Everything the *model* produced — rationale, suggestion,
 * evidence, file paths — is attacker-influenceable and goes through
 * `escapeHtml` here.
 */
export const reviewsSection: DashboardSectionStrategy = {
  id: 'reviews',
  title: 'Code Review',
  navLabel: 'Code Review',
  fileName: 'reviews.html',
  description: 'Findings from reviewed pull requests, anchored to the reviewed diff.',
  badge: (metrics) => (metrics.reviewCount > 0 ? `${metrics.reviewFindingCount} finding(s)` : 'no reviews'),
  render: ({ data, diffs }) => renderReviews(data.reviews ?? [], diffs),
};

function renderReviews(reviews: ConsoleReview[], diffs?: PreparedConsoleDiffs): string {
  if (reviews.length === 0) {
    return `<section class="panel" aria-label="Code review">
          <div class="section-head">
            <div>
              <h2>Code Review</h2>
              <div class="section-note">No review artifacts captured yet.</div>
            </div>
          </div>
          <p class="empty-note">Run a review to populate this page. Each review records its findings and the diff they were raised against, so this evidence reads the same offline as it did on the day it ran.</p>
        </section>`;
  }

  return reviews.map((review) => renderReview(review, diffs)).join('\n');
}

function renderReview(review: ConsoleReview, diffs?: PreparedConsoleDiffs): string {
  const artifact = review.artifact;
  const rendered = diffs?.byRunId[artifact.runId];
  const findings = artifact.findings ?? [];
  const renderedPaths = new Set(rendered?.files.map((file) => file.filePath) ?? []);
  // A finding whose file never appeared in the diff must still be shown:
  // silently dropping one is the worst failure mode a review tool has.
  const orphans = findings.filter((finding) => !renderedPaths.has(finding.file));

  return `<section class="panel" aria-label="Review ${escapeHtml(artifact.runId)}">
          <div class="section-head">
            <div>
              <h2>${escapeHtml(reviewTitle(artifact))}</h2>
              <div class="section-note">${escapeHtml(reviewSubtitle(artifact))}</div>
            </div>
          </div>
          ${rendered ? rendered.files.map((file) => renderFile(file)).join('\n') : ''}
          ${!rendered ? '<p class="empty-note">No diff was captured for this review, so findings are shown without code context.</p>' : ''}
          ${orphans.length > 0 ? `<div class="review-file">
            <div class="review-file-head"><span class="review-file-name">${rendered ? 'Findings outside the rendered diff' : 'Findings'}</span></div>
            ${orphans.map(renderFinding).join('\n')}
          </div>` : ''}
          ${rendered?.truncated ? `<p class="empty-note">Showing ${rendered.files.length} of ${rendered.totalFiles} changed files, ranked by risk.</p>` : ''}
        </section>`;
}

function renderFile(file: RenderedDiffFile): string {
  return `<div class="review-file">
            <div class="review-file-head">
              <span class="review-file-name">${escapeHtml(file.filePath)}</span>
              <span class="review-file-count">${file.findings.length} finding${file.findings.length === 1 ? '' : 's'}</span>
            </div>
            ${file.findings.map(renderFinding).join('\n')}
            ${file.error
              ? `<p class="empty-note">This file's diff could not be rendered: ${escapeHtml(file.error)}</p>`
              : `<div class="review-diff fdekit-diff">${file.html}</div>`}
          </div>`;
}

function renderFinding(finding: ReviewFinding): string {
  return `<div class="review-finding sev-${escapeHtml(finding.severity)}">
              <div class="review-finding-head">
                <span class="review-chip sev-${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span>
                <span class="review-chip">${escapeHtml(finding.category)}</span>
                <span class="review-chip">confidence ${Math.round((finding.confidence ?? 0) * 100)}%</span>
                <span class="review-finding-loc">${escapeHtml(finding.file)}:${escapeHtml(String(finding.line))}</span>
              </div>
              <p class="review-rationale">${escapeHtml(finding.rationale)}</p>
              ${finding.suggestion ? `<p class="review-suggestion"><strong>Suggestion.</strong> ${escapeHtml(finding.suggestion)}</p>` : ''}
              <ul class="review-evidence">${(finding.evidence ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            </div>`;
}

function reviewTitle(artifact: ReviewArtifact): string {
  const source = artifact.source;

  if (source?.kind === 'github-pr' && source.repository) {
    return `${source.repository}#${source.number ?? '?'}`;
  }

  return `${source?.base ?? '?'}...${source?.head ?? 'HEAD'}`;
}

function reviewSubtitle(artifact: ReviewArtifact): string {
  const parts = [
    `${(artifact.findings ?? []).length} finding(s) kept`,
    `${(artifact.suppressed ?? []).length} suppressed by the grader`,
    `recommendation: ${artifact.recommendation}`,
  ];

  if (artifact.ticket) {
    parts.push(`${artifact.ticket.system} ${artifact.ticket.key}`);
  }

  return parts.join(' · ');
}
