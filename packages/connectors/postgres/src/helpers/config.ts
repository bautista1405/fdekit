import {
  DEFAULT_ALLOWED_STATEMENTS,
  DEFAULT_REDACTED_COLUMN_PATTERNS,
  DEFAULT_REDACTED_COLUMNS,
  DEFAULT_SCHEMAS,
} from './constants.js';
import { normalizeIdentifierList, normalizeSchemaList } from './identifiers.js';
import type { PostgresRuntimeConfig } from './types.js';
import type {
  PostgresConnectorConfig,
  PostgresConnectorOptions,
} from '../interfaces/index.js';

export function createRuntimeConfig(options: PostgresConnectorOptions): PostgresRuntimeConfig {
  const mode = options.mode ?? (options.queryClient ? 'client' : 'pg');

  return {
    mode,
    connectionStringEnv: options.connectionStringEnv ?? 'DATABASE_URL',
    allowedStatements: options.allowedStatements ?? DEFAULT_ALLOWED_STATEMENTS,
    allowedTables: normalizeIdentifierList(options.allowedTables ?? []),
    deniedTables: normalizeIdentifierList(options.deniedTables ?? []),
    maxRows: positiveInteger(options.maxRows, 100),
    maxSqlLength: positiveInteger(options.maxSqlLength, 20_000),
    queryTimeoutMs: positiveInteger(options.queryTimeoutMs, 5_000),
    statementTimeoutMs: positiveInteger(options.statementTimeoutMs, 5_000),
    schemaDiscovery: options.schemaDiscovery ?? true,
    schemas: normalizeSchemaList(options.schemas ?? DEFAULT_SCHEMAS),
    pool: {
      max: positiveInteger(options.pool?.max, 5),
      idleTimeoutMillis: positiveInteger(options.pool?.idleTimeoutMillis, 10_000),
      connectionTimeoutMillis: positiveInteger(options.pool?.connectionTimeoutMillis, 5_000),
      ssl: options.pool?.ssl ?? false,
      applicationName: options.pool?.applicationName ?? 'fdekit',
    },
    allowMultipleStatements: options.allowMultipleStatements ?? false,
    allowSqlComments: options.allowSqlComments ?? false,
    allowSelectStar: options.allowSelectStar ?? false,
    redactSensitiveColumns: options.redactSensitiveColumns ?? true,
    redactedColumns: normalizeIdentifierList(options.redactedColumns ?? DEFAULT_REDACTED_COLUMNS),
    redactedColumnPatterns: options.redactedColumnPatterns ?? DEFAULT_REDACTED_COLUMN_PATTERNS,
    redactionReplacement: options.redactionReplacement ?? '[REDACTED]',
  };
}

export function toConnectorConfig(runtime: PostgresRuntimeConfig): PostgresConnectorConfig {
  return {
    mode: runtime.mode,
    connectionStringEnv: runtime.connectionStringEnv,
    allowedStatements: runtime.allowedStatements,
    allowedTables: runtime.allowedTables,
    deniedTables: runtime.deniedTables,
    maxRows: runtime.maxRows,
    maxSqlLength: runtime.maxSqlLength,
    queryTimeoutMs: runtime.queryTimeoutMs,
    statementTimeoutMs: runtime.statementTimeoutMs,
    schemaDiscovery: {
      enabled: runtime.schemaDiscovery,
      schemas: runtime.schemas,
    },
    pool: {
      max: runtime.pool.max,
      idleTimeoutMillis: runtime.pool.idleTimeoutMillis,
      connectionTimeoutMillis: runtime.pool.connectionTimeoutMillis,
      ssl: Boolean(runtime.pool.ssl),
    },
    security: {
      allowMultipleStatements: runtime.allowMultipleStatements,
      allowSqlComments: runtime.allowSqlComments,
      allowSelectStar: runtime.allowSelectStar,
      redactSensitiveColumns: runtime.redactSensitiveColumns,
      redactionReplacement: runtime.redactionReplacement,
    },
  };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}
