export function statusPill(status: string): string {
  const normalized = status.toLowerCase();
  const kind = statusPillKind(normalized);

  return `<span class="pill ${kind}">${escapeHtml(status)}</span>`;
}

function statusPillKind(normalized: string): string {
  if (normalized === 'declared' || normalized === 'advisory') {
    return normalized;
  }

  if (normalized === 'not measured') {
    return 'not-measured';
  }

  if (normalized === 'pass'
    || normalized === 'passed'
    || normalized === 'completed'
    || normalized === 'clear'
    || normalized === 'allowed'
    || normalized === 'succeeded'
    || normalized === 'approved'
    || normalized === 'ready') {
    return 'pass';
  }

  if (normalized === 'fail' || normalized === 'failed' || normalized === 'blocked' || normalized === 'rejected') {
    return 'fail';
  }

  return 'warn';
}

export function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function linkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return 'open';
  }
}

export function shortId(value: string): string {
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

export function roundChartNumber(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

export function percentile(values: number[], targetPercentile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((targetPercentile / 100) * sorted.length) - 1;

  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}

export function csvCell(value: unknown): string {
  const text = String(value ?? '');

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function markdownCell(value: unknown): string {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', '<br>');
}

export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] ?? char));
}
