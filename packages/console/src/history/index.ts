import type { ConsoleHistoryEntry } from '../interfaces/index.js';
import { escapeHtml, formatDate } from '../view-models/index.js';

export function renderDashboardHistory(history: ConsoleHistoryEntry[]): string {
  if (history.length === 0) {
    return '<p class="subtle">No preserved dashboard snapshots yet.</p>';
  }

  return `<div>
    ${[...history].reverse().slice(0, 6).map((entry) => `<div class="history-row">
      <div class="row-label">${escapeHtml(entry.evalStatus)}</div>
      <div class="row-main">
        <a href="${escapeHtml(entry.file)}">${escapeHtml(formatDate(entry.createdAt))}</a>
        <div class="event-meta">${escapeHtml(`${entry.traceCount} trace(s) - ${entry.deployment}`)}</div>
      </div>
    </div>`).join('')}
  </div>`;
}
