import type {
  PostgresConnectorMode,
  PostgresDriverResult,
  PostgresPoolOptions,
  PostgresQueryInput,
  SqlStatementKind,
} from '../interfaces/index.js';

export interface PostgresRuntimeConfig {
  mode: PostgresConnectorMode;
  connectionStringEnv: string;
  allowedStatements: SqlStatementKind[];
  allowedTables: string[];
  deniedTables: string[];
  maxRows: number;
  maxSqlLength: number;
  queryTimeoutMs: number;
  statementTimeoutMs: number;
  schemaDiscovery: boolean;
  schemas: string[];
  pool: Required<Omit<PostgresPoolOptions, 'ssl' | 'applicationName'>> & {
    ssl: boolean | Record<string, unknown>;
    applicationName: string;
  };
  allowMultipleStatements: boolean;
  allowSqlComments: boolean;
  allowSelectStar: boolean;
  redactSensitiveColumns: boolean;
  redactedColumns: string[];
  redactedColumnPatterns: RegExp[];
  redactionReplacement: string;
}

export interface ValidatedSql {
  sql: string;
  statement: SqlStatementKind;
  tables: string[];
}

export interface QueryExecutor {
  query: (query: PostgresQueryInput, timeoutMs?: number) => Promise<PostgresDriverResult>;
}
