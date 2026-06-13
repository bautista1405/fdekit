import { asRecord, asString, getNumber } from '@fdekit/core';
import { shouldRedactColumn } from './redaction.js';
import type { PostgresRuntimeConfig } from './types.js';
import type {
  PostgresColumnSummary,
  PostgresTableSummary,
} from '../interfaces/index.js';

const getString = asString;

export function assertSchemaDiscoveryEnabled(runtime: PostgresRuntimeConfig): void {
  if (!runtime.schemaDiscovery) {
    throw new Error('Postgres schema discovery is disabled for this connector');
  }
}

export function toTableSummary(row: unknown): PostgresTableSummary | undefined {
  const record = asRecord(row);
  const schema = getString(record.table_schema);
  const name = getString(record.table_name);
  const type = getString(record.table_type);

  if (!schema || !name || !type) {
    return undefined;
  }

  return {
    schema,
    name,
    type,
  };
}

export function toColumnSummary(row: unknown, runtime: PostgresRuntimeConfig): PostgresColumnSummary | undefined {
  const record = asRecord(row);
  const name = getString(record.column_name);
  const dataType = getString(record.data_type);

  if (!name || !dataType) {
    return undefined;
  }

  return {
    name,
    dataType,
    nullable: getString(record.is_nullable)?.toUpperCase() === 'YES',
    defaultValue: getString(record.column_default),
    ordinalPosition: getNumber(record.ordinal_position),
    redacted: shouldRedactColumn(name, runtime),
  };
}
