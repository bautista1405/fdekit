import type {
  ConsoleMetrics,
  RunHistoryItem,
} from '../../interfaces/index.js';
import {
  escapeHtml,
  formatDate,
  shortId,
  statusPill,
} from '../../view-models/index.js';

export function renderCostLatency(metrics: ConsoleMetrics): string {
  if (metrics.runHistory.length === 0) {
    return '<p class="subtle">No completed run cost or latency captured yet.</p>';
  }

  return `<div>
    <div class="mini-metrics">
      <div class="mini-metric"><strong>${escapeHtml(`${Math.round(metrics.avgLatencyMs)}ms`)}</strong><span class="subtle">average latency</span></div>
      <div class="mini-metric"><strong>${escapeHtml(`${Math.round(metrics.p95LatencyMs)}ms`)}</strong><span class="subtle">p95 latency</span></div>
      <div class="mini-metric"><strong>${escapeHtml(`$${metrics.totalCostUsd.toFixed(4)}`)}</strong><span class="subtle">total cost</span></div>
    </div>
    <table>
      <thead><tr><th>Run</th><th>Status</th><th>Latency</th><th>Cost</th></tr></thead>
      <tbody>
        ${metrics.runHistory.slice(0, 6).map((run) => `<tr>
          <td>
            <span class="mono">${escapeHtml(shortId(run.traceId))}</span>
            <div class="event-meta">${escapeHtml(formatDate(run.createdAt))}</div>
          </td>
          <td>${statusPill(run.status)}</td>
          <td>${escapeHtml(`${Math.round(run.latencyMs)}ms`)}</td>
          <td>${escapeHtml(`$${run.costUsd.toFixed(4)}`)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

export function renderToolBars(toolCounts: ConsoleMetrics['toolCounts']): string {
  if (toolCounts.length === 0) {
    return '<p class="subtle">No tool calls captured yet.</p>';
  }

  const max = Math.max(...toolCounts.map((tool) => tool.count), 1);

  return `<div class="bars">
    ${toolCounts.map((tool) => `<div class="bar-row">
      <span class="mono">${escapeHtml(tool.name)}</span>
      <span class="track"><span class="bar" style="width: ${Math.round((tool.count / max) * 100)}%"></span></span>
      <span class="right">${tool.count}</span>
    </div>`).join('')}
  </div>`;
}

export function renderRunHistory(history: RunHistoryItem[]): string {
  if (history.length === 0) {
    return '<p class="subtle">No run history yet.</p>';
  }

  return `<table>
    <thead><tr><th>Run</th><th>Status</th><th>Actions</th><th>Latency</th></tr></thead>
    <tbody>
      ${history.slice(0, 8).map((run) => `<tr>
        <td>
          <span class="mono">${escapeHtml(shortId(run.traceId))}</span>
          <div class="event-meta">${escapeHtml(formatDate(run.createdAt))}</div>
        </td>
        <td>${statusPill(run.status)}</td>
        <td>${escapeHtml(`${run.toolCalls.length} tools, ${run.issueCount} issues, ${run.slackCount} Slack`)}</td>
        <td>${escapeHtml(`${Math.round(run.latencyMs)}ms`)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}
