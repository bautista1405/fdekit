import { describe, expect, it } from 'vitest';
import {
  asArray,
  asOptionalRecord,
  asRecord,
  asString,
  escapeRegExp,
  getNumber,
  getString,
  isDefined,
  numberFromEnv,
  pick,
} from '../index.js';

describe('shared helpers', () => {
  it('normalizes common unknown values without throwing', () => {
    expect(asRecord({ ok: true })).toEqual({ ok: true });
    expect(asRecord(null)).toEqual({});
    expect(asRecord(['nope'])).toEqual({});
    expect(asOptionalRecord({ id: '1' })).toEqual({ id: '1' });
    expect(asOptionalRecord({})).toBeUndefined();
    expect(asArray(['a'])).toEqual(['a']);
    expect(asArray('a')).toEqual([]);
  });

  it('extracts primitive values consistently', () => {
    expect(asString('')).toBe('');
    expect(getString('')).toBeUndefined();
    expect(getString('value')).toBe('value');
    expect(getNumber(3)).toBe(3);
    expect(getNumber(Number.NaN)).toBeUndefined();
    expect(['value', undefined].filter(isDefined)).toEqual(['value']);
  });

  it('handles env, regex, and enum helper cases', () => {
    expect(escapeRegExp('a+b?')).toBe('a\\+b\\?');
    expect(pick('google', ['mock', 'google'] as const, 'mock')).toBe('google');
    expect(pick('openai', ['mock', 'google'] as const, 'mock')).toBe('mock');
    expect(numberFromEnv('LIMIT', 5, { LIMIT: '10' })).toBe(10);
    expect(numberFromEnv('LIMIT', 5, { LIMIT: 'oops' })).toBe(5);
  });
});
