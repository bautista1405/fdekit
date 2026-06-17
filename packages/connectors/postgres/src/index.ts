import { defineConnector, defineTool, type ConnectorDefinition } from '@fdekit/core';
import {
  assertSchemaDiscoveryEnabled,
  createQueryExecutor,
  createRuntimeConfig,
  enforceTableGovernance,
  getNumber,
  isDefined,
  isString,
  isTableAllowed,
  normalizeSchemaList,
  parseTableReference,
  redactRows,
  toColumnSummary,
  toConnectorConfig,
  toTableSummary,
  validateSql,
} from './helpers/index.js';
import type { PostgresColumnSummary, PostgresConnectorConfig, PostgresConnectorMode, PostgresConnectorOptions, PostgresDescribeTableArgs, PostgresDescribeTableResult, PostgresDriverResult, PostgresHealthCheckArgs, PostgresHealthCheckResult, PostgresListTablesArgs, PostgresListTablesResult, PostgresPoolOptions, PostgresQueryArgs, PostgresQueryClient, PostgresQueryInput, PostgresQueryResult, PostgresTableSummary, SqlStatementKind } from './interfaces/index.js';
export type { PostgresColumnSummary, PostgresConnectorConfig, PostgresConnectorMode, PostgresConnectorOptions, PostgresDescribeTableArgs, PostgresDescribeTableResult, PostgresDriverResult, PostgresHealthCheckArgs, PostgresHealthCheckResult, PostgresListTablesArgs, PostgresListTablesResult, PostgresPoolOptions, PostgresQueryArgs, PostgresQueryClient, PostgresQueryInput, PostgresQueryResult, PostgresTableSummary, SqlStatementKind } from './interfaces/index.js';

const defaultToolEnvironments = ['local', 'development', 'staging'];

const healthCheckArgsSchema = {
  type: 'object',
  properties: {
    timeoutMs: {
      type: 'number',
      description: 'Optional query timeout override in milliseconds',
    },
  },
};

const listTablesArgsSchema = {
  type: 'object',
  properties: {
    schemas: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional schemas to inspect',
    },
    includeViews: {
      type: 'boolean',
      description: 'Whether to include views as well as base tables',
    },
    limit: {
      type: 'number',
      description: 'Maximum number of tables to return',
    },
    timeoutMs: {
      type: 'number',
      description: 'Optional query timeout override in milliseconds',
    },
  },
};

const describeTableArgsSchema = {
  type: 'object',
  required: ['table'],
  properties: {
    table: {
      type: 'string',
      description: 'Table name or schema-qualified table reference',
    },
    schema: {
      type: 'string',
      description: 'Optional schema when table is not schema-qualified',
    },
    timeoutMs: {
      type: 'number',
      description: 'Optional query timeout override in milliseconds',
    },
  },
};

const queryArgsSchema = {
  type: 'object',
  required: ['sql'],
  properties: {
    sql: {
      type: 'string',
      description: 'Governed SQL statement to execute',
    },
    values: {
      type: 'array',
      description: 'Optional parameter values for the SQL statement',
    },
    name: {
      type: 'string',
      description: 'Optional prepared statement name',
    },
    timeoutMs: {
      type: 'number',
      description: 'Optional query timeout override in milliseconds',
    },
  },
};

export function postgresConnector(options: PostgresConnectorOptions = {}): ConnectorDefinition<PostgresConnectorConfig> {
  const runtime = createRuntimeConfig(options);
  const executor = createQueryExecutor(options, runtime);

  return defineConnector({
    name: 'postgres',
    description: 'Run governed parameterized queries against Postgres',
    config: toConnectorConfig(runtime),
    env: runtime.mode === 'pg' && !options.connectionString
      ? [
        {
          name: runtime.connectionStringEnv,
          required: true,
          description: 'Postgres connection string used by the pg adapter',
        },
      ]
      : [],
    tools: [
      defineTool<PostgresHealthCheckArgs, PostgresHealthCheckResult>({
        name: 'postgres.healthCheck',
        description: 'Verify that the Postgres connector can execute a minimal query',
        scopes: ['database:read'],
        environments: defaultToolEnvironments,
        category: 'database',
        tags: ['context', 'database', 'read'],
        argsSchema: healthCheckArgsSchema,
        async handler(args) {
          const startedAt = Date.now();
          await executor.query({
            text: 'select 1 as ok',
            name: 'fdekit_postgres_health_check',
          }, args.timeoutMs ?? runtime.queryTimeoutMs);

          return {
            mode: runtime.mode,
            ok: true,
            latencyMs: Date.now() - startedAt,
          };
        },
      }),
      defineTool<PostgresListTablesArgs, PostgresListTablesResult>({
        name: 'postgres.listTables',
        description: 'List visible Postgres tables and views for schema discovery',
        scopes: ['database:schema'],
        environments: defaultToolEnvironments,
        category: 'database',
        tags: ['context', 'database', 'schema'],
        argsSchema: listTablesArgsSchema,
        async handler(args) {
          assertSchemaDiscoveryEnabled(runtime);
          const schemas = normalizeSchemaList(args.schemas ?? runtime.schemas);
          const includeViews = args.includeViews ?? true;
          const limit = Math.min(Math.max(args.limit ?? runtime.maxRows, 1), runtime.maxRows);
          const tableTypes = includeViews ? ['BASE TABLE', 'VIEW'] : ['BASE TABLE'];
          const result = await executor.query({
            text: `
              select table_schema, table_name, table_type
              from information_schema.tables
              where table_schema = any($1)
                and table_type = any($2)
              order by table_schema, table_name
              limit $3
            `,
            values: [schemas, tableTypes, limit + 1],
            name: 'fdekit_postgres_list_tables',
          }, args.timeoutMs ?? runtime.queryTimeoutMs);
          const tables = (result.rows ?? [])
            .map(toTableSummary)
            .filter((table): table is PostgresTableSummary => Boolean(table))
            .filter((table) => isTableAllowed(`${table.schema}.${table.name}`, runtime));
          const visible = tables.slice(0, limit);

          return {
            mode: runtime.mode,
            schemas,
            tables: visible,
            truncated: tables.length > visible.length,
          };
        },
      }),
      defineTool<PostgresDescribeTableArgs, PostgresDescribeTableResult>({
        name: 'postgres.describeTable',
        description: 'Describe columns for one governed Postgres table',
        scopes: ['database:schema'],
        environments: defaultToolEnvironments,
        category: 'database',
        tags: ['context', 'database', 'schema'],
        argsSchema: describeTableArgsSchema,
        async handler(args) {
          assertSchemaDiscoveryEnabled(runtime);
          const tableRef = parseTableReference(args.table, args.schema, runtime.schemas[0] ?? 'public');
          enforceTableGovernance([`${tableRef.schema}.${tableRef.table}`], runtime);
          const result = await executor.query({
            text: `
              select column_name, data_type, is_nullable, column_default, ordinal_position
              from information_schema.columns
              where table_schema = $1
                and table_name = $2
              order by ordinal_position
            `,
            values: [tableRef.schema, tableRef.table],
            name: 'fdekit_postgres_describe_table',
          }, args.timeoutMs ?? runtime.queryTimeoutMs);

          return {
            mode: runtime.mode,
            schema: tableRef.schema,
            table: tableRef.table,
            columns: (result.rows ?? []).map((row) => toColumnSummary(row, runtime)).filter(isDefined),
          };
        },
      }),
      defineTool<PostgresQueryArgs, PostgresQueryResult>({
        name: 'postgres.query',
        description: 'Run a governed parameterized SQL query; defaults to SELECT/WITH only',
        scopes: ['database:read'],
        environments: defaultToolEnvironments,
        category: 'database',
        tags: ['context', 'database', 'read'],
        argsSchema: queryArgsSchema,
        async handler(args) {
          const validated = validateSql(args.sql, runtime);
          const result = await executor.query({
            text: validated.sql,
            values: args.values,
            name: args.name,
          }, args.timeoutMs ?? runtime.queryTimeoutMs);
          const fields = result.fields?.map((field) => field.name).filter(isString);
          const rows = (result.rows ?? []).slice(0, runtime.maxRows) as Record<string, unknown>[];
          const redacted = redactRows(rows, runtime);
          const rowCount = getNumber(result.rowCount) ?? rows.length;

          return {
            mode: runtime.mode,
            statement: validated.statement,
            tables: validated.tables,
            rowCount,
            rows: redacted.rows,
            fields,
            truncated: rowCount > redacted.rows.length,
            redactedColumns: redacted.columns,
          };
        },
      }),
    ],
  });
}
