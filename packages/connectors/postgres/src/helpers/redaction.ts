import { normalizeIdentifier } from './identifiers.js';
import type { PostgresRuntimeConfig } from './types.js';

export function redactRows(
  rows: Record<string, unknown>[],
  runtime: PostgresRuntimeConfig,
): { rows: Record<string, unknown>[]; columns: string[] } {
  if (!runtime.redactSensitiveColumns) {
    return { rows, columns: [] };
  }

  const columns = new Set<string>();
  const redactedRows = rows.map((row) => {
    const next: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      if (shouldRedactColumn(key, runtime)) {
        columns.add(key);
        next[key] = runtime.redactionReplacement;
      } else {
        next[key] = value;
      }
    }

    return next;
  });

  return {
    rows: redactedRows,
    columns: [...columns].sort(),
  };
}

export function shouldRedactColumn(column: string, runtime: PostgresRuntimeConfig): boolean {
  const normalized = normalizeIdentifier(column);

  return runtime.redactedColumns.includes(normalized)
    || runtime.redactedColumnPatterns.some((pattern) => pattern.test(column));
}
