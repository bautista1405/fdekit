import type { TraceEvent } from '../../traces/index.js';

export function countValues(values: string[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();

  for (const value of values.filter(isString)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

export function formatCounts(items: Array<{ name: string; count: number }>): string {
  return items.map((item) => `${item.name} (${item.count})`).join(', ');
}

export function escapeMarkdown(value: string): string {
  return value.replaceAll('|', '\\|');
}

export function findLastEvent(events: TraceEvent[], type: string): TraceEvent | undefined {
  return events.slice().reverse().find((event) => event.type === type);
}

export function humanizeSignal(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

export function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
