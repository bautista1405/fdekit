export const FINDING_CATEGORIES = ['bug', 'security', 'arch', 'perf', 'tests', 'style', 'intent-mismatch'] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export type FindingSeverity = 'high' | 'medium' | 'low';

export interface ReviewFinding {
  file: string;
  /** 1-based line in the new version of the file. */
  line: number;
  severity: FindingSeverity;
  category: FindingCategory;
  /** 0..1; model-claimed on emission, overwritten by the grader score. */
  confidence: number;
  rationale: string;
  suggestion?: string;
  /**
   * REQUIRED grounding: file:line references or short quotes that anchor the
   * finding in the reviewed code. A finding with no evidence is dropped by
   * `parseFindings` before the grader ever sees it — this is the strictest
   * link in the anti-hallucination chain. The grader then scores the QUALITY
   * of the grounding; this gate only guarantees grounding exists.
   */
  evidence: string[];
}

export interface SuppressedReviewFinding extends ReviewFinding {
  suppressedBy: 'grader';
  graderScore: number;
}

export interface ReviewArtifactSource {
  kind: 'github-pr' | 'local-diff';
  repository?: string;
  number?: number;
  base?: string;
  head?: string;
}

export interface ReviewArtifactTicket {
  system: 'linear' | 'jira';
  key: string;
  title?: string;
}

export interface ReviewArtifact {
  runId: string;
  source: ReviewArtifactSource;
  ticket?: ReviewArtifactTicket;
  findings: ReviewFinding[];
  suppressed: SuppressedReviewFinding[];
  recommendation: 'comment' | 'request-changes';
  createdAt: string;
  /**
   * File name of the sibling text artifact in the `reviews` group holding the
   * reviewed unified diff (conventionally `<runId>.patch`).
   *
   * Without it a review cannot be re-read offline: the console would have to
   * refetch the diff from the forge to show what was reviewed, which breaks
   * both the emailable-artifact property (ADR-0004) and the audit claim that
   * the artifact records what the agent actually saw. Optional so reviews
   * written before this field remain valid; the console degrades to a
   * findings-only view when it is absent.
   */
  patchArtifact?: string;
}

export interface DroppedFinding {
  /** Position of the rejected row in the submitted list (0-based). */
  index: number;
  /** Field-named, actionable rules the row failed. */
  reasons: string[];
}

export interface ParsedFindings {
  valid: ReviewFinding[];
  /** Shorthand for `dropped.length`. */
  invalid: number;
  dropped: DroppedFinding[];
}

/**
 * Validates model-emitted findings against the review contract, dropping
 * malformed rows instead of throwing: anything that does not match the schema
 * never reaches the grader or a PR comment (the output-contract defense).
 *
 * Every dropped row carries field-named reasons. Feed
 * `formatDroppedFindings(result.dropped)` back to the model to let it repair
 * and resubmit, and record it in the run trace so operators can see WHY rows
 * were rejected instead of a bare count.
 *
 * Accepts a findings array directly or wrapped as `{ findings: [...] }`, and
 * strips unknown extra fields from valid rows.
 */
export function parseFindings(raw: unknown): ParsedFindings {
  const valid: ReviewFinding[] = [];
  const dropped: DroppedFinding[] = [];

  findingsList(raw).forEach((item, index) => {
    const { finding, reasons } = validateFinding(item);

    if (finding) {
      valid.push(finding);
    } else {
      dropped.push({ index, reasons });
    }
  });

  return { valid, invalid: dropped.length, dropped };
}

/**
 * Renders dropped-finding reasons as one actionable message, suitable both for
 * run traces and for feeding back to the model for a repair attempt.
 */
export function formatDroppedFindings(dropped: DroppedFinding[]): string {
  if (dropped.length === 0) {
    return 'no findings were dropped';
  }

  const rows = dropped.map((entry) => `finding[${entry.index}]: ${entry.reasons.join('; ')}`);

  return `${dropped.length} finding(s) dropped by the review contract - ${rows.join(' | ')}`;
}

const findingSeverities: readonly string[] = ['high', 'medium', 'low'];

function findingsList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (raw && typeof raw === 'object') {
    const wrapped = (raw as { findings?: unknown }).findings;

    if (Array.isArray(wrapped)) {
      return wrapped;
    }
  }

  return [];
}

function validateFinding(item: unknown): { finding: ReviewFinding | null; reasons: string[] } {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { finding: null, reasons: ['finding must be a JSON object'] };
  }

  const record = item as Record<string, unknown>;
  const reasons: string[] = [];

  if (typeof record.file !== 'string' || record.file.length === 0) {
    reasons.push('file: required non-empty string (relative path in the reviewed codebase)');
  }

  if (typeof record.line !== 'number' || !Number.isFinite(record.line) || record.line < 1) {
    reasons.push('line: must be a finite number >= 1 (1-based line in the new file version)');
  }

  if (typeof record.severity !== 'string' || !findingSeverities.includes(record.severity)) {
    reasons.push('severity: must be one of high|medium|low');
  }

  if (typeof record.category !== 'string' || !(FINDING_CATEGORIES as readonly string[]).includes(record.category)) {
    reasons.push(`category: must be one of ${FINDING_CATEGORIES.join('|')}`);
  }

  if (typeof record.confidence !== 'number' || record.confidence < 0 || record.confidence > 1) {
    reasons.push('confidence: must be a number between 0 and 1');
  }

  if (typeof record.rationale !== 'string' || record.rationale.length === 0) {
    reasons.push('rationale: required non-empty string');
  }

  if (record.suggestion !== undefined && typeof record.suggestion !== 'string') {
    reasons.push('suggestion: must be a string when present');
  }

  if (!Array.isArray(record.evidence) || record.evidence.length === 0 || !record.evidence.every((entry) => typeof entry === 'string')) {
    reasons.push('evidence: required non-empty array of strings - ground the finding with file:line references or short quotes from the reviewed code; ungrounded findings are dropped before grading');
  }

  if (reasons.length > 0) {
    return { finding: null, reasons };
  }

  return {
    finding: {
      file: record.file as string,
      line: record.line as number,
      severity: record.severity as FindingSeverity,
      category: record.category as FindingCategory,
      confidence: record.confidence as number,
      rationale: record.rationale as string,
      suggestion: record.suggestion as string | undefined,
      evidence: record.evidence as string[],
    },
    reasons: [],
  };
}
