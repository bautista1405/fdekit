import { asRecord, readProcessEnv } from '@fdekit/core';
import type { PostgresRuntimeConfig, QueryExecutor } from './types.js';
import type {
  PostgresConnectorOptions,
  PostgresDriverResult,
  PostgresQueryInput,
} from '../interfaces/index.js';

export function createQueryExecutor(
  options: PostgresConnectorOptions,
  runtime: PostgresRuntimeConfig,
): QueryExecutor {
  if (options.queryClient) {
    return {
      query(query, timeoutMs) {
        return withTimeout(
          options.queryClient?.query(query) ?? Promise.reject(new Error('Postgres query client is unavailable')),
          timeoutMs,
          `Postgres query timed out after ${timeoutMs}ms`,
        );
      },
    };
  }

  let poolPromise: Promise<PostgresPool> | undefined;

  return {
    async query(query, timeoutMs) {
      if (!poolPromise) {
        poolPromise = createPgPool({
          connectionString: options.connectionString ?? requireConnectionString(runtime.connectionStringEnv, options.env),
          runtime,
        });
      }

      const pool = await poolPromise;
      return withTimeout(
        pool.query(query),
        timeoutMs,
        `Postgres query timed out after ${timeoutMs}ms`,
      );
    },
  };
}

async function createPgPool(options: {
  connectionString: string;
  runtime: PostgresRuntimeConfig;
}): Promise<PostgresPool> {
  const pg = await importPg();

  return new pg.Pool({
    connectionString: options.connectionString,
    application_name: options.runtime.pool.applicationName,
    max: options.runtime.pool.max,
    idleTimeoutMillis: options.runtime.pool.idleTimeoutMillis,
    connectionTimeoutMillis: options.runtime.pool.connectionTimeoutMillis,
    query_timeout: options.runtime.queryTimeoutMs,
    statement_timeout: options.runtime.statementTimeoutMs,
    ssl: options.runtime.pool.ssl,
  });
}

async function importPg(): Promise<{
  Pool: new (options: Record<string, unknown>) => PostgresPool;
}> {
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<unknown>;
    const module = asRecord(await dynamicImport('pg'));
    const defaultExport = asRecord(module.default);
    const Pool = module.Pool ?? defaultExport.Pool;

    if (typeof Pool !== 'function') {
      throw new Error('pg module did not export Pool');
    }

    return { Pool: Pool as never };
  } catch (err) {
    throw new Error(`Postgres pg mode requires the optional "pg" package; install pg or pass postgresConnector({ queryClient }) ${err instanceof Error ? err.message : ''}`.trim());
  }
}

interface PostgresPool {
  query: (query: PostgresQueryInput) => Promise<PostgresDriverResult>;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number | undefined, message: string): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function requireConnectionString(connectionStringEnv: string, env = readProcessEnv()): string {
  const connectionString = env[connectionStringEnv];

  if (!connectionString) {
    throw new Error(`Missing Postgres connection string: set ${connectionStringEnv} or pass postgresConnector({ queryClient })`);
  }

  return connectionString;
}
