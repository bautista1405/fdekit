import { escapeHtml, statusPill } from '../view-models/index.js';

export function renderNavGroup(label: string, values: string[]): string {
  const content = values.length > 0
    ? values.map((value) => `<span class="nav-value">${escapeHtml(value)}</span>`).join('')
    : '<span class="nav-value subtle">none</span>';

  return `<div class="nav-group"><div class="nav-label">${escapeHtml(label)}</div>${content}</div>`;
}

export function renderKpi(
  label: string,
  value: string,
  note: string,
  status?: 'pass' | 'warn' | 'fail',
): string {
  const flag = status && status !== 'pass' ? statusPill(status) : '';

  return `<article class="kpi${status ? ` ${status}` : ''}">
    <div class="kpi-head">
      <div class="label">${escapeHtml(label)}</div>
      ${flag}
    </div>
    <div class="value">${escapeHtml(value)}</div>
    <div class="note">${escapeHtml(note)}</div>
  </article>`;
}

export function renderDetailPanel(title: string, body: string, open = false): string {
  return `<details class="detail-panel"${open ? ' open' : ''}>
    <summary>${escapeHtml(title)}</summary>
    <div class="detail-body">${body}</div>
  </details>`;
}

export function renderHandoffRow(label: string, value: string): string {
  return `<div class="handoff-row">
    <div class="row-label">${escapeHtml(label)}</div>
    <div class="row-main">${escapeHtml(value)}</div>
  </div>`;
}

export function renderReadinessList(
  items: Array<{ label: string; status: 'pass' | 'warn' | 'fail' | 'advisory'; detail: string }>,
): string {
  if (items.length === 0) {
    return '<p class="subtle">No readiness data captured yet.</p>';
  }

  return `<div class="readiness-list">
    ${items.map((item) => `<div class="readiness-item">
      <div>${statusPill(item.status)}</div>
      <div class="row-main">
        <strong>${escapeHtml(item.label)}</strong>
        <div class="event-meta">${escapeHtml(item.detail)}</div>
      </div>
    </div>`).join('')}
  </div>`;
}
