import { describe, expect, it } from 'vitest';
import { postgresConnector } from '../index.js';

describe('postgresConnector', () => {
  it('declares validation metadata on every tool', () => {
    const connector = postgresConnector();

    for (const tool of connector.tools ?? []) {
      expect(tool.environments).toEqual(['local', 'development', 'staging']);
      expect(tool.argsSchema).toBeDefined();
    }
  });

  it('runs SELECT queries through a provided query client', async () => {
    const queries: unknown[] = [];
    const connector = postgresConnector({
      queryClient: {
        async query(query) {
          queries.push(query);
          return {
            rows: [{ id: 'cus_company', tier: 'enterprise' }],
            rowCount: 1,
            fields: [{ name: 'id' }, { name: 'tier' }],
          };
        },
      },
    });
    const tool = findTool(connector, 'postgres.query');

    expect(connector.config?.mode).toBe('client');
    await expect(tool.handler({
      sql: 'select id, tier from customers where id = $1',
      values: ['cus_company'],
      name: 'customer_lookup',
    }, {})).resolves.toEqual({
      mode: 'client',
      statement: 'select',
      tables: ['customers'],
      rowCount: 1,
      rows: [{ id: 'cus_company', tier: 'enterprise' }],
      fields: ['id', 'tier'],
      truncated: false,
      redactedColumns: [],
    });
    expect(queries).toEqual([{
      text: 'select id, tier from customers where id = $1',
      values: ['cus_company'],
      name: 'customer_lookup',
    }]);
  });

  it('blocks mutation statements by default', async () => {
    const connector = postgresConnector({
      queryClient: {
        async query() {
          return { rows: [], rowCount: 0 };
        },
      },
    });
    const tool = findTool(connector, 'postgres.query');

    await expect(tool.handler({
      sql: 'delete from customers',
    }, {})).rejects.toThrow('Statement "delete" is not allowed');
  });

  it('blocks common SQL escape hatches by default', async () => {
    const connector = postgresConnector({
      queryClient: {
        async query() {
          return { rows: [], rowCount: 0 };
        },
      },
    });
    const tool = findTool(connector, 'postgres.query');

    await expect(tool.handler({
      sql: 'select id from customers; select id from users',
    }, {})).rejects.toThrow('Multiple SQL statements are disabled');
    await expect(tool.handler({
      sql: 'select id from customers -- inspect users',
    }, {})).rejects.toThrow('SQL comments are disabled');
    await expect(tool.handler({
      sql: 'select * from customers',
    }, {})).rejects.toThrow('SELECT * is disabled');
    await expect(tool.handler({
      sql: 'with deleted as (delete from customers returning id) select id from deleted',
    }, {})).rejects.toThrow('Keyword "delete" is not allowed');
    await expect(tool.handler({
      sql: "select id, 'delete -- inside a value' as note from customers",
    }, {})).resolves.toMatchObject({
      tables: ['customers'],
    });
  });

  it('enforces table allowlists and denylists inside the connector', async () => {
    const connector = postgresConnector({
      allowedTables: ['customers', 'tickets'],
      deniedTables: ['private.audit_logs'],
      queryClient: {
        async query() {
          return { rows: [], rowCount: 0 };
        },
      },
    });
    const tool = findTool(connector, 'postgres.query');

    await expect(tool.handler({
      sql: 'select id from customers join tickets on tickets.customer_id = customers.id',
    }, {})).resolves.toMatchObject({
      tables: ['customers', 'tickets'],
    });
    await expect(tool.handler({
      sql: 'select id from users',
    }, {})).rejects.toThrow('Table "users" is not in the allowed table list');
    await expect(tool.handler({
      sql: 'select id from private.audit_logs',
    }, {})).rejects.toThrow('Table "private.audit_logs" is denied');
  });

  it('redacts sensitive result columns by default', async () => {
    const connector = postgresConnector({
      queryClient: {
        async query() {
          return {
            rows: [{
              id: 'cus_company',
              email: 'buyer@company.example',
              api_key: 'secret-key',
              tier: 'enterprise',
            }],
            rowCount: 1,
          };
        },
      },
    });
    const tool = findTool(connector, 'postgres.query');

    await expect(tool.handler({
      sql: 'select id, email, api_key, tier from customers where id = $1',
      values: ['cus_company'],
    }, {})).resolves.toMatchObject({
      rows: [{
        id: 'cus_company',
        email: '[REDACTED]',
        api_key: '[REDACTED]',
        tier: 'enterprise',
      }],
      redactedColumns: ['api_key', 'email'],
    });
  });

  it('lists and describes schema through governed discovery tools', async () => {
    const queries: string[] = [];
    const connector = postgresConnector({
      allowedTables: ['public.customers'],
      deniedTables: ['private.audit_logs'],
      queryClient: {
        async query(query) {
          queries.push(query.text);

          if (query.name === 'fdekit_postgres_list_tables') {
            return {
              rows: [
                { table_schema: 'public', table_name: 'customers', table_type: 'BASE TABLE' },
                { table_schema: 'private', table_name: 'audit_logs', table_type: 'BASE TABLE' },
              ],
              rowCount: 2,
            };
          }

          return {
            rows: [
              {
                column_name: 'id',
                data_type: 'text',
                is_nullable: 'NO',
                ordinal_position: 1,
              },
              {
                column_name: 'email',
                data_type: 'text',
                is_nullable: 'YES',
                ordinal_position: 2,
              },
            ],
            rowCount: 2,
          };
        },
      },
    });

    await expect(findTool(connector, 'postgres.listTables').handler({
      schemas: ['public', 'private'],
    }, {})).resolves.toEqual({
      mode: 'client',
      schemas: ['public', 'private'],
      tables: [{ schema: 'public', name: 'customers', type: 'BASE TABLE' }],
      truncated: false,
    });
    await expect(findTool(connector, 'postgres.describeTable').handler({
      table: 'customers',
      schema: 'public',
    }, {})).resolves.toEqual({
      mode: 'client',
      schema: 'public',
      table: 'customers',
      columns: [
        {
          name: 'id',
          dataType: 'text',
          nullable: false,
          defaultValue: undefined,
          ordinalPosition: 1,
          redacted: false,
        },
        {
          name: 'email',
          dataType: 'text',
          nullable: true,
          defaultValue: undefined,
          ordinalPosition: 2,
          redacted: true,
        },
      ],
    });
    await expect(findTool(connector, 'postgres.describeTable').handler({
      table: 'private.audit_logs',
    }, {})).rejects.toThrow('Table "private.audit_logs" is denied');
    expect(queries.some((query) => query.includes('information_schema.tables'))).toBe(true);
    expect(queries.some((query) => query.includes('information_schema.columns'))).toBe(true);
  });

  it('times out slow query clients', async () => {
    const connector = postgresConnector({
      queryTimeoutMs: 5,
      queryClient: {
        async query() {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return { rows: [], rowCount: 0 };
        },
      },
    });

    await expect(findTool(connector, 'postgres.healthCheck').handler({}, {}))
      .rejects.toThrow('Postgres query timed out after 5ms');
  });

  it('declares DATABASE_URL when using pg mode', () => {
    const connector = postgresConnector({ mode: 'pg', connectionStringEnv: 'TEST_DATABASE_URL' });

    expect(connector.env).toEqual([{
      name: 'TEST_DATABASE_URL',
      required: true,
      description: 'Postgres connection string used by the pg adapter',
    }]);
    expect(connector.config).toMatchObject({
      mode: 'pg',
      connectionStringEnv: 'TEST_DATABASE_URL',
      queryTimeoutMs: 5000,
      statementTimeoutMs: 5000,
      schemaDiscovery: {
        enabled: true,
        schemas: ['public'],
      },
      security: {
        allowMultipleStatements: false,
        allowSqlComments: false,
        allowSelectStar: false,
        redactSensitiveColumns: true,
      },
    });
  });
});

function findTool(
  connector: ReturnType<typeof postgresConnector>,
  name: string,
): NonNullable<ReturnType<typeof postgresConnector>['tools']>[number] {
  const tool = connector.tools?.find((candidate) => candidate.name === name);

  if (!tool) {
    throw new Error(`Missing tool ${name}`);
  }

  return tool;
}
