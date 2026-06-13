export { getNumber, isDefined } from '@fdekit/core';
export * from './config.js';
export * from './executor.js';
export * from './identifiers.js';
export * from './redaction.js';
export * from './schema.js';
export * from './sql-validation.js';
export type * from './types.js';

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}
