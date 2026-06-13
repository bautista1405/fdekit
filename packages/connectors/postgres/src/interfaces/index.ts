export type PostgresConnectorMode = 'client' | 'pg';

export type SqlStatementKind = 'select' | 'insert' | 'update' | 'delete' | 'with' | 'merge';

export interface PostgresConnectorConfig extends Record<string, unknown> {
  mode: PostgresConnectorMode;
  connectionStringEnv: string;
  allowedStatements: SqlStatementKind[];
  allowedTables: string[];
  deniedTables: string[];
  maxRows: number;
  maxSqlLength: number;
  queryTimeoutMs: number;
  statementTimeoutMs: number;
  schemaDiscovery: {
    enabled: boolean;
    schemas: string[];
  };
  pool: {
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
    ssl: boolean;
  };
  security: {
    allowMultipleStatements: boolean;
    allowSqlComments: boolean;
    allowSelectStar: boolean;
    redactSensitiveColumns: boolean;
    redactionReplacement: string;
  };
}

export interface PostgresQueryArgs {
  sql: string;
  values?: unknown[];
  name?: string;
  timeoutMs?: number;
}

export interface PostgresQueryResult<Row = Record<string, unknown>> {
  mode: PostgresConnectorMode;
  statement: SqlStatementKind;
  tables: string[];
  rowCount: number;
  rows: Row[];
  fields?: string[];
  truncated: boolean;
  redactedColumns: string[];
}

export interface PostgresHealthCheckArgs {
  timeoutMs?: number;
}

export interface PostgresHealthCheckResult {
  mode: PostgresConnectorMode;
  ok: boolean;
  latencyMs: number;
}

export interface PostgresListTablesArgs {
  schemas?: string[];
  includeViews?: boolean;
  limit?: number;
  timeoutMs?: number;
}

export interface PostgresTableSummary {
  schema: string;
  name: string;
  type: string;
}

export interface PostgresListTablesResult {
  mode: PostgresConnectorMode;
  schemas: string[];
  tables: PostgresTableSummary[];
  truncated: boolean;
}

export interface PostgresDescribeTableArgs {
  table: string;
  schema?: string;
  timeoutMs?: number;
}

export interface PostgresColumnSummary {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string;
  ordinalPosition?: number;
  redacted: boolean;
}

export interface PostgresDescribeTableResult {
  mode: PostgresConnectorMode;
  schema: string;
  table: string;
  columns: PostgresColumnSummary[];
}

export interface PostgresQueryClient {
  query: (query: PostgresQueryInput) => Promise<PostgresDriverResult>;
}

export interface PostgresQueryInput {
  text: string;
  values?: unknown[];
  name?: string;
}

export interface PostgresDriverResult {
  rows?: unknown[];
  rowCount?: number | null;
  fields?: Array<{ name?: string }>;
}

export interface PostgresPoolOptions {
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | Record<string, unknown>;
  applicationName?: string;
}

export interface PostgresConnectorOptions {
  mode?: PostgresConnectorMode;
  connectionString?: string;
  connectionStringEnv?: string;
  queryClient?: PostgresQueryClient;
  allowedStatements?: SqlStatementKind[];
  allowedTables?: string[];
  deniedTables?: string[];
  maxRows?: number;
  maxSqlLength?: number;
  queryTimeoutMs?: number;
  statementTimeoutMs?: number;
  schemaDiscovery?: boolean;
  schemas?: string[];
  pool?: PostgresPoolOptions;
  allowMultipleStatements?: boolean;
  allowSqlComments?: boolean;
  allowSelectStar?: boolean;
  redactSensitiveColumns?: boolean;
  redactedColumns?: string[];
  redactedColumnPatterns?: RegExp[];
  redactionReplacement?: string;
  env?: Record<string, string | undefined>;
}
