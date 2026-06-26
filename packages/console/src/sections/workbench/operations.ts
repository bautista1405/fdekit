import type {
  ConsoleMetrics,
  RunHistoryItem,
} from '../../interfaces/index.js';
import {
  escapeHtml,
  formatDate,
  percentile,
  shortId,
  statusPill,
} from '../../view-models/index.js';

export function renderRunLatencyStats(history: RunHistoryItem[]): string {
  if (history.length === 0) {
    return '<p class="subtle">No completed run latency or cost captured yet.</p>';
  }

  const latencies = history.map((run) => run.latencyMs).filter((value) => value >= 0);
  const avg = latencies.length > 0
    ? latencies.reduce((total, value) => total + value, 0) / latencies.length
    : 0;
  const p95 = percentile(latencies, 95);
  const totalCost = history.reduce((total, run) => total + run.costUsd, 0);

  return `<div class="mini-metrics">
    <div class="mini-metric"><strong>${escapeHtml(`${Math.round(avg)}ms`)}</strong><span class="subtle">avg latency / run</span></div>
    <div class="mini-metric"><strong>${escapeHtml(`${Math.round(p95)}ms`)}</strong><span class="subtle">p95 latency</span></div>
    <div class="mini-metric"><strong>${escapeHtml(`$${totalCost.toFixed(4)}`)}</strong><span class="subtle">cost / ${history.length} run(s)</span></div>
  </div>`;
}

export function renderToolBars(toolCounts: ConsoleMetrics['toolCounts']): string {
  if (toolCounts.length === 0) {
    return '<p class="subtle">No tool calls captured in the reviewed run yet.</p>';
  }

  const maxTime = Math.max(...toolCounts.map((tool) => tool.avgLatencyMs * tool.count), 1);

  return `<div class="bars">
    ${toolCounts.map((tool) => {
      const totalMs = tool.avgLatencyMs * tool.count;

      return `<div class="bar-row">
      <span class="bar-label"><span class="mono">${escapeHtml(tool.name)}</span><span class="bar-sub">×${tool.count}</span></span>
      <span class="track"><span class="bar" style="width: ${Math.max(Math.round((totalMs / maxTime) * 100), 2)}%"></span></span>
      <span class="right">${escapeHtml(`${Math.round(tool.avgLatencyMs)}ms`)}</span>
    </div>`;
    }).join('')}
  </div>`;
}

export function renderRunHistory(history: RunHistoryItem[]): string {
  if (history.length === 0) {
    return '<p class="subtle">No run history yet.</p>';
  }

  return `${renderFailureBreakdown(history)}
  <table>
    <thead><tr><th>Run</th><th>Status</th><th>Actions</th><th>Latency</th><th>Cost</th></tr></thead>
    <tbody>
      ${history.slice(0, 8).map((run) => `<tr>
        <td>
          <span class="mono">${escapeHtml(shortId(run.traceId))}</span>
          <div class="event-meta">${escapeHtml(formatDate(run.createdAt))}</div>
        </td>
        <td>${renderRunStatus(run)}</td>
        <td>${escapeHtml(`${run.toolCalls.length} call(s) · ${run.issueCount + run.slackCount} write(s)`)}</td>
        <td>${escapeHtml(`${Math.round(run.latencyMs)}ms`)}</td>
        <td>${escapeHtml(`$${run.costUsd.toFixed(4)}`)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function renderFailureBreakdown(history: RunHistoryItem[]): string {
  const failures = history.filter((run) => run.failureCategory);

  if (failures.length === 0) {
    return '<p class="subtle">No failed run reasons captured in history.</p>';
  }

  const categoryOrder = ['infra', 'policy-block', 'tool-error', 'max-steps', 'model-error', 'other'];
  const categories = categoryOrder
    .map((category) => failures.filter((run) => run.failureCategory === category))
    .filter((runs) => runs.length > 0);

  return `<div class="chart-title">Run outcome breakdown</div>
  <div class="mini-metrics">
    ${categories.map((runs) => {
      const sample = runs[0];

      return `<div class="mini-metric">
        <strong>${escapeHtml(String(runs.length))}</strong>
        <span class="subtle">${escapeHtml(outcomeBreakdownLabel(sample, runs.length))}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function renderRunStatus(run: RunHistoryItem): string {
  if (run.failureCategory === 'policy-block') {
    return `<div class="status-stack">
      <div><span class="pill info">Governance stopped</span> <span class="pill info">${escapeHtml(run.failureLabel ?? 'Policy block')}</span></div>
      <div class="event-meta">${escapeHtml(run.failureReason ?? 'Policy blocked this run')}</div>
    </div>`;
  }

  if (!run.failureReason) {
    return statusPill(run.status);
  }

  return `<div class="status-stack">
    <div>${statusPill(run.status)} <span class="pill info">${escapeHtml(run.failureLabel ?? 'Other')}</span></div>
    <div class="event-meta">${escapeHtml(run.failureReason)}</div>
  </div>`;
}

function outcomeBreakdownLabel(run: RunHistoryItem | undefined, count: number): string {
  const suffix = count === 1 ? '' : 's';

  if (run?.failureCategory === 'policy-block') {
    return `Governance stop${suffix}`;
  }

  return `${run?.failureLabel ?? 'Other'} failure${suffix}`;
}
