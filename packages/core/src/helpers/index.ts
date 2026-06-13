export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? record : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function pick<const T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function numberFromEnv(name: string, fallback: number, env = readProcessEnv()): number {
  const value = Number(env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export function readProcessEnv(): Record<string, string | undefined> {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}

export function shellEscape(value: string): string {
  if (/^[a-zA-Z0-9_./:@=-]+$/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function mergeEnv(
  base: Record<string, string | undefined> | undefined,
  overrides: Record<string, string | undefined> | undefined,
): Record<string, string | undefined> | undefined {
  const merged = {
    ...(base ?? {}),
    ...(overrides ?? {}),
  };
  const compact = Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined));

  return Object.keys(compact).length > 0 ? compact : undefined;
}
