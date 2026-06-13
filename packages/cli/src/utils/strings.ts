export function objectKey(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : JSON.stringify(value);
}

export function indentBlock(value: string, indent: string): string {
  return value
    .split('\n')
    .map((line) => (line.length > 0 ? `${indent}${line}` : line))
    .join('\n');
}

export function escapeSingleQuoted(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
