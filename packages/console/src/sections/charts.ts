import type {
  ConsoleMetrics,
  GovernancePostureItem,
  RunHistoryItem,
} from '../interfaces/index.js';
import {
  escapeHtml,
  roundChartNumber,
  statusPill,
} from '../view-models/index.js';

export function renderCharts(metrics: ConsoleMetrics): string {
  return `<div class="chart-grid">
    <div class="chart-block">
      <div class="chart-title">Eval Pass Rate</div>
      ${renderEvalDonut(metrics)}
    </div>
    <div class="chart-block">
      <div class="chart-title">Tool Mix</div>
      ${renderActionMix(metrics)}
    </div>
    <div class="chart-block">
      <div class="chart-title">Latency Trend</div>
      ${renderLatencySparkline(metrics.allRunHistory)}
    </div>
  </div>`;
}

export function renderGovernancePosture(items: GovernancePostureItem[]): string {
  return `<div class="control-grid">
    ${items.map((item) => `<article class="control-card">
      <div class="control-head">
        <div class="control-title">${escapeHtml(item.label)}</div>
        ${statusPill(item.status)}
      </div>
      <div class="event-meta">${escapeHtml(item.detail)}</div>
    </article>`).join('')}
  </div>`;
}

function renderEvalDonut(metrics: ConsoleMetrics): string {
  const total = Math.max(metrics.evalCaseCount, 0);
  const passed = Math.max(metrics.evalPassedCases, 0);

  if (total === 0) {
    return `<div class="donut-wrap">
      <div class="donut empty" data-label="–"></div>
      <div>
        <strong>Not run</strong>
        <div class="event-meta">Run <span class="mono">fdekit eval</span> to measure pass rate</div>
      </div>
    </div>`;
  }

  const percent = Math.round((passed / total) * 100);

  return `<div class="donut-wrap">
    <div class="donut" style="--donut-pass: ${percent}%;" data-label="${escapeHtml(`${percent}%`)}"></div>
    <div>
      <strong>${escapeHtml(`${passed}/${total} cases passed`)}</strong>
      <div class="event-meta">${escapeHtml(`${metrics.evalStatus} eval status`)}</div>
    </div>
  </div>`;
}

function renderActionMix(metrics: ConsoleMetrics): string {
  const issues = metrics.createdIssues.length;
  const slack = metrics.slackMessages.length;
  const otherTools = Math.max(metrics.toolCallCount - issues - slack, 0);
  const total = Math.max(issues + slack + otherTools, 1);

  return `<div>
    <div class="stacked-bar" aria-label="External action mix">
      <span class="stacked-segment issues" style="width: ${Math.max((issues / total) * 100, issues > 0 ? 3 : 0)}%"></span>
      <span class="stacked-segment slack" style="width: ${Math.max((slack / total) * 100, slack > 0 ? 3 : 0)}%"></span>
      <span class="stacked-segment tools" style="width: ${(otherTools / total) * 100}%"></span>
    </div>
    <div class="legend" style="margin-top: 12px;">
      <span class="legend-item"><span class="legend-dot issues"></span>${escapeHtml(`${issues} issues`)}</span>
      <span class="legend-item"><span class="legend-dot slack"></span>${escapeHtml(`${slack} Slack`)}</span>
      <span class="legend-item"><span class="legend-dot tools"></span>${escapeHtml(`${otherTools} other tools`)}</span>
    </div>
  </div>`;
}

function renderLatencySparkline(history: RunHistoryItem[]): string {
  const runs = [...history].reverse().slice(-10);

  if (runs.length === 0) {
    return '<p class="subtle">No completed run latency captured yet.</p>';
  }

  if (runs.length === 1) {
    const only = runs[0];

    return `<div class="chart-stat">
      <strong>${escapeHtml(`${Math.round(only?.latencyMs ?? 0)}ms`)}</strong>
      <div class="event-meta">Single run; trend appears once a second run is captured.</div>
    </div>`;
  }

  const width = 280;
  const height = 92;
  const padding = 8;
  const maxLatency = Math.max(...runs.map((run) => run.latencyMs), 1);
  const denominator = Math.max(runs.length - 1, 1);
  const points = runs.map((run, index) => {
    const x = padding + ((width - padding * 2) * index) / denominator;
    const y = height - padding - ((height - padding * 2) * run.latencyMs) / maxLatency;

    return `${roundChartNumber(x)},${roundChartNumber(y)}`;
  }).join(' ');
  const latest = runs.at(-1);

  return `<div>
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Latency trend">
      <line class="baseline" x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
      <polyline points="${escapeHtml(points)}"></polyline>
    </svg>
    <div class="event-meta">${escapeHtml(`Latest ${Math.round(latest?.latencyMs ?? 0)}ms; max ${Math.round(maxLatency)}ms`)}</div>
  </div>`;
}
