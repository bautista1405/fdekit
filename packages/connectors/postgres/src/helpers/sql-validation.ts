import { escapeRegExp } from '@fdekit/core';
import {
  ALWAYS_BLOCKED_KEYWORDS,
  READ_ONLY_BLOCKED_KEYWORDS,
} from './constants.js';
import {
  isIdentifierListed,
  normalizeIdentifier,
  unqualifiedIdentifier,
} from './identifiers.js';
import {
  maskSqlLiterals,
  scanSql,
  stripSqlComments,
} from './sql-scanner.js';
import type { PostgresRuntimeConfig, ValidatedSql } from './types.js';
import type { SqlStatementKind } from '../interfaces/index.js';

export function validateSql(sqlInput: string, runtime: PostgresRuntimeConfig): ValidatedSql {
  if (typeof sqlInput !== 'string') {
    throw new Error('Postgres query blocked: SQL must be a string');
  }

  const sql = sqlInput.trim();

  if (!sql) {
    throw new Error('Postgres query blocked: SQL cannot be empty');
  }

  if (sql.length > runtime.maxSqlLength) {
    throw new Error(`Postgres query blocked: SQL exceeds ${runtime.maxSqlLength} characters`);
  }

  if (!runtime.allowSqlComments && containsSqlComment(sql)) {
    throw new Error('Postgres query blocked: SQL comments are disabled');
  }

  const normalized = normalizeSqlStatement(sql, runtime);
  const masked = stripSqlComments(maskSqlLiterals(normalized));
  const statement = getStatementKind(masked);

  if (!runtime.allowedStatements.includes(statement)) {
    throw new Error(`Postgres query blocked: Statement "${statement}" is not allowed`);
  }

  blockDangerousKeywords(masked, statement, runtime);

  if (!runtime.allowSelectStar && hasSelectStar(masked)) {
    throw new Error('Postgres query blocked: SELECT * is disabled; request explicit columns');
  }

  const tables = extractTableNames(masked);
  enforceTableGovernance(tables, runtime);

  return { sql: normalized, statement, tables };
}

export function enforceTableGovernance(tables: string[], runtime: PostgresRuntimeConfig): void {
  const denied = tables.find((table) => isIdentifierListed(table, runtime.deniedTables));

  if (denied) {
    throw new Error(`Postgres query blocked: Table "${denied}" is denied`);
  }

  const disallowed = runtime.allowedTables.length > 0
    ? tables.find((table) => !isIdentifierListed(table, runtime.allowedTables))
    : undefined;

  if (disallowed) {
    throw new Error(`Postgres query blocked: Table "${disallowed}" is not in the allowed table list`);
  }
}

export function isTableAllowed(table: string, runtime: PostgresRuntimeConfig): boolean {
  if (isIdentifierListed(table, runtime.deniedTables)) {
    return false;
  }

  return runtime.allowedTables.length === 0 || isIdentifierListed(table, runtime.allowedTables);
}

export function parseTableReference(table: string, schema: string | undefined, defaultSchema: string): {
  schema: string;
  table: string;
} {
  const normalized = normalizeIdentifier(table);
  const parts = normalized.split('.');

  if (parts.length > 2 || parts.some((part) => !part)) {
    throw new Error(`Invalid Postgres table reference: ${table}`);
  }

  if (parts.length === 2) {
    return { schema: parts[0], table: parts[1] };
  }

  return {
    schema: normalizeIdentifier(schema ?? defaultSchema),
    table: parts[0],
  };
}

function normalizeSqlStatement(sql: string, runtime: PostgresRuntimeConfig): string {
  if (runtime.allowMultipleStatements) {
    return sql;
  }

  const withoutTrailingSemicolon = sql.replace(/;\s*$/, '').trim();

  if (hasStatementSeparator(withoutTrailingSemicolon)) {
    throw new Error('Postgres query blocked: Multiple SQL statements are disabled');
  }

  return withoutTrailingSemicolon;
}

function getStatementKind(sql: string): SqlStatementKind {
  const first = /^[\s(]*([a-z]+)/i.exec(sql)?.[1]?.toLowerCase();

  if (first === 'select' || first === 'insert' || first === 'update' || first === 'delete' || first === 'with' || first === 'merge') {
    return first;
  }

  throw new Error(`Unsupported SQL statement: ${first ?? 'empty'}`);
}

function blockDangerousKeywords(sql: string, statement: SqlStatementKind, runtime: PostgresRuntimeConfig): void {
  const keywords = new Set(ALWAYS_BLOCKED_KEYWORDS);

  if (statement === 'select' || statement === 'with') {
    for (const keyword of READ_ONLY_BLOCKED_KEYWORDS) {
      keywords.add(keyword);
    }
  }

  const matched = findKeyword(sql, [...keywords]);

  if (matched) {
    throw new Error(`Postgres query blocked: Keyword "${matched}" is not allowed`);
  }

  if (statement === 'with' && findKeyword(sql, READ_ONLY_BLOCKED_KEYWORDS)) {
    throw new Error('Postgres query blocked: Mutating WITH statements are disabled');
  }
}

function hasStatementSeparator(sql: string): boolean {
  return scanSql(sql, {
    onCode(char) {
      return char === ';';
    },
  });
}

function containsSqlComment(sql: string): boolean {
  return scanSql(sql, {
    onCode(char, index, source) {
      return (char === '-' && source[index + 1] === '-') || (char === '/' && source[index + 1] === '*');
    },
  });
}

function findKeyword(sql: string, keywords: string[]): string | undefined {
  for (const keyword of keywords) {
    const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');

    if (pattern.test(sql)) {
      return keyword;
    }
  }

  return undefined;
}

function hasSelectStar(sql: string): boolean {
  return /\bselect\s+(?:distinct\s+)?(?:(?:"?[a-zA-Z_][a-zA-Z0-9_$]*"?\s*\.)?\*)/i.test(sql);
}

function extractTableNames(sql: string): string[] {
  const tables = new Set<string>();
  const ctes = extractCteNames(sql);
  const pattern = /\b(?:from|join|update|into)\s+((?:"[^"]+"|[a-zA-Z_][a-zA-Z0-9_$]*)(?:\s*\.\s*(?:"[^"]+"|[a-zA-Z_][a-zA-Z0-9_$]*))?)/gi;
  let match = pattern.exec(sql);

  while (match) {
    const table = normalizeIdentifier(match[1]);

    if (table && !ctes.has(unqualifiedIdentifier(table))) {
      tables.add(table);
    }

    match = pattern.exec(sql);
  }

  return [...tables];
}

function extractCteNames(sql: string): Set<string> {
  const ctes = new Set<string>();

  if (!/^\s*with\b/i.test(sql)) {
    return ctes;
  }

  const pattern = /(?:with\s+(?:recursive\s+)?|,\s*)("?([a-zA-Z_][a-zA-Z0-9_$]*)"?)(?:\s*\([^)]*\))?\s+as\s*\(/gi;
  let match = pattern.exec(sql);

  while (match) {
    ctes.add(match[2].toLowerCase());
    match = pattern.exec(sql);
  }

  return ctes;
}
