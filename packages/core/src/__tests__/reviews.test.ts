import { describe, expect, it } from 'vitest';
import { formatDroppedFindings, parseFindings } from '../reviews/index.js';

const validFinding = {
  file: 'src/billing.ts',
  line: 12,
  severity: 'high',
  category: 'bug',
  confidence: 0.9,
  rationale: 'Missing await on an async call drops the rejection',
  suggestion: 'await syncBilling()',
  evidence: ['src/billing.ts:12'],
};

describe('parseFindings', () => {
  it('passes valid findings through and strips unknown extra fields', () => {
    const { valid, invalid, dropped } = parseFindings([{ ...validFinding, hallucinatedField: 'x' }]);

    expect(invalid).toBe(0);
    expect(dropped).toEqual([]);
    expect(valid).toEqual([validFinding]);
    expect('hallucinatedField' in valid[0]).toBe(false);
  });

  it('accepts the { findings: [...] } wrapper models commonly emit', () => {
    expect(parseFindings({ findings: [validFinding] }).valid).toHaveLength(1);
  });

  it('returns empty results for non-array input', () => {
    expect(parseFindings(null)).toEqual({ valid: [], invalid: 0, dropped: [] });
    expect(parseFindings('not json')).toEqual({ valid: [], invalid: 0, dropped: [] });
    expect(parseFindings({ notFindings: [] })).toEqual({ valid: [], invalid: 0, dropped: [] });
  });

  it('drops malformed rows and counts them', () => {
    const malformed = [
      { ...validFinding, line: 0 },
      { ...validFinding, line: '12' },
      { ...validFinding, severity: 'critical' },
      { ...validFinding, category: 'vibes' },
      { ...validFinding, confidence: 1.2 },
      { ...validFinding, confidence: '0.9' },
      { ...validFinding, rationale: '' },
      { ...validFinding, file: '' },
      { ...validFinding, evidence: 'src/billing.ts:12' },
      { ...validFinding, evidence: ['ok', 42] },
      { ...validFinding, suggestion: 42 },
      null,
      'finding',
    ];

    const { valid, invalid } = parseFindings([validFinding, ...malformed]);

    expect(valid).toHaveLength(1);
    expect(invalid).toBe(malformed.length);
  });

  it('rejects ungrounded findings: evidence must be a non-empty string array', () => {
    const { valid, dropped } = parseFindings([{ ...validFinding, evidence: [] }]);

    expect(valid).toEqual([]);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reasons).toEqual([
      expect.stringContaining('evidence: required non-empty array'),
    ]);
    expect(dropped[0].reasons[0]).toContain('ungrounded findings are dropped before grading');
  });

  it('names every failed field so the model can repair and resubmit', () => {
    const { dropped } = parseFindings([
      { ...validFinding, line: 0, severity: 'critical', evidence: [] },
      { ...validFinding, category: 'vibes' },
    ]);

    expect(dropped[0].index).toBe(0);
    expect(dropped[0].reasons).toHaveLength(3);
    expect(dropped[0].reasons.join(' ')).toMatch(/line:.*severity:.*evidence:/s);
    expect(dropped[1]).toMatchObject({ index: 1, reasons: ['category: must be one of bug|security|arch|perf|tests|style|intent-mismatch'] });
  });

  it('accepts findings without the optional suggestion', () => {
    const { suggestion, ...withoutSuggestion } = validFinding;

    expect(parseFindings([withoutSuggestion]).valid).toHaveLength(1);
  });
});

describe('formatDroppedFindings', () => {
  it('renders an actionable one-line message for traces and model retry', () => {
    const { dropped } = parseFindings([validFinding, { ...validFinding, evidence: [] }]);
    const message = formatDroppedFindings(dropped);

    expect(message).toContain('1 finding(s) dropped by the review contract');
    expect(message).toContain('finding[1]: evidence:');
  });

  it('reports the empty case explicitly', () => {
    expect(formatDroppedFindings([])).toBe('no findings were dropped');
  });
});
