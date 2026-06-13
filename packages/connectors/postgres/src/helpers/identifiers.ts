export function normalizeIdentifierList(values: string[]): string[] {
  return [...new Set(values.map(normalizeIdentifier).filter(Boolean))];
}

export function normalizeIdentifier(value: string): string {
  return value
    .split('.')
    .map((part) => part.trim().replace(/^"|"$/g, '').replace(/""/g, '"').toLowerCase())
    .join('.');
}

export function unqualifiedIdentifier(value: string): string {
  return value.split('.').at(-1) ?? value;
}

export function isIdentifierListed(identifier: string, list: string[]): boolean {
  const normalized = normalizeIdentifier(identifier);
  const unqualified = unqualifiedIdentifier(normalized);

  return list.some((candidate) => {
    const normalizedCandidate = normalizeIdentifier(candidate);
    return normalized === normalizedCandidate || unqualified === normalizedCandidate;
  });
}

export function normalizeSchemaList(values: string[]): string[] {
  const schemas = normalizeIdentifierList(values).filter((value) => /^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(value));

  if (schemas.length === 0) {
    throw new Error('Postgres schema discovery requires at least one valid schema');
  }

  return schemas;
}
