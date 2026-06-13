import type { SqlStatementKind } from '../interfaces/index.js';

export const DEFAULT_ALLOWED_STATEMENTS: SqlStatementKind[] = ['select', 'with'];
export const DEFAULT_SCHEMAS = ['public'];
export const DEFAULT_REDACTED_COLUMNS = [
  'access_token',
  'api_key',
  'apikey',
  'authorization',
  'card_number',
  'credit_card',
  'email',
  'password',
  'password_hash',
  'phone',
  'secret',
  'ssn',
  'token',
];
export const DEFAULT_REDACTED_COLUMN_PATTERNS = [
  /api[_-]?key/i,
  /authorization/i,
  /card/i,
  /credit/i,
  /email/i,
  /password/i,
  /phone/i,
  /secret/i,
  /ssn/i,
  /token/i,
];

export const ALWAYS_BLOCKED_KEYWORDS = [
  'alter',
  'analyze',
  'call',
  'copy',
  'create',
  'deallocate',
  'discard',
  'do',
  'drop',
  'execute',
  'grant',
  'listen',
  'lock',
  'notify',
  'prepare',
  'refresh',
  'reindex',
  'reset',
  'revoke',
  'set',
  'truncate',
  'unlisten',
  'vacuum',
];
export const READ_ONLY_BLOCKED_KEYWORDS = ['delete', 'insert', 'merge', 'update'];
