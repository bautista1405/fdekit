export function scanSql(
  sql: string,
  visitor: {
    onCode: (char: string, index: number, source: string) => boolean;
  },
): boolean {
  let singleQuote = false;
  let doubleQuote = false;
  let dollarQuote: string | undefined;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];

    if (dollarQuote) {
      if (sql.startsWith(dollarQuote, index)) {
        index += dollarQuote.length - 1;
        dollarQuote = undefined;
      }

      continue;
    }

    if (singleQuote) {
      if (char === '\'' && sql[index + 1] === '\'') {
        index += 1;
      } else if (char === '\'') {
        singleQuote = false;
      }

      continue;
    }

    if (doubleQuote) {
      if (char === '"' && sql[index + 1] === '"') {
        index += 1;
      } else if (char === '"') {
        doubleQuote = false;
      }

      continue;
    }

    if (char === '\'') {
      singleQuote = true;
      continue;
    }

    if (char === '"') {
      doubleQuote = true;
      continue;
    }

    if (char === '$') {
      const tag = /^\$[a-zA-Z_][a-zA-Z0-9_]*\$|^\$\$/.exec(sql.slice(index))?.[0];

      if (tag) {
        dollarQuote = tag;
        index += tag.length - 1;
        continue;
      }
    }

    if (visitor.onCode(char, index, sql)) {
      return true;
    }
  }

  return false;
}

export function stripSqlComments(sql: string): string {
  return sql
    .replace(/--[^\n\r]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

export function maskSqlLiterals(sql: string): string {
  let result = '';
  let singleQuote = false;
  let doubleQuote = false;
  let dollarQuote: string | undefined;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];

    if (dollarQuote) {
      if (sql.startsWith(dollarQuote, index)) {
        result += ' ';
        index += dollarQuote.length - 1;
        dollarQuote = undefined;
      } else {
        result += ' ';
      }

      continue;
    }

    if (singleQuote) {
      result += ' ';

      if (char === '\'' && sql[index + 1] === '\'') {
        index += 1;
        result += ' ';
      } else if (char === '\'') {
        singleQuote = false;
      }

      continue;
    }

    if (doubleQuote) {
      result += char;

      if (char === '"' && sql[index + 1] === '"') {
        index += 1;
        result += sql[index];
      } else if (char === '"') {
        doubleQuote = false;
      }

      continue;
    }

    if (char === '\'') {
      singleQuote = true;
      result += ' ';
      continue;
    }

    if (char === '"') {
      doubleQuote = true;
      result += char;
      continue;
    }

    if (char === '$') {
      const tag = /^\$[a-zA-Z_][a-zA-Z0-9_]*\$|^\$\$/.exec(sql.slice(index))?.[0];

      if (tag) {
        dollarQuote = tag;
        result += ' '.repeat(tag.length);
        index += tag.length - 1;
        continue;
      }
    }

    result += char;
  }

  return result;
}
