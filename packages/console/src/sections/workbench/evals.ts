import type {
  ConsoleMetrics,
  ReusablePatternItem,
  SnapshotTrendItem,
} from '../../interfaces/index.js';
import type {
  EvalCaseResult,
  EvalArtifact,
  EvalSuiteResult,
  MacroEvalArtifact,
} from '@fdekit/runtime';
import {
  escapeHtml,
  formatDate,
  statusPill,
} from '../../view-models/index.js';

export function renderEvalResults(evalArtifact: EvalArtifact | null): string {
  if (!evalArtifact) {
    return '<p class="subtle">No eval artifact found.</p>';
  }

  const rows: Array<{ suite: EvalSuiteResult; evalCase: EvalCaseResult | null }> = [];

  for (const suite of evalArtifact.results) {
    if (suite.cases && suite.cases.length > 0) {
      rows.push(...suite.cases.map((evalCase) => ({
        suite,
        evalCase,
      })));
    } else {
      rows.push({
        suite,
        evalCase: null,
      });
    }
  }

  return `<table>
    <thead>
      <tr>
        <th>Suite</th>
        <th>Case</th>
        <th>Status</th>
        <th>Tool calls</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(({ suite, evalCase }) => `<tr>
        <td>${escapeHtml(suite.name)}</td>
        <td>${escapeHtml(evalCase?.name ?? 'suite-level')}</td>
        <td>${statusPill(evalCase?.status ?? suite.status)}</td>
        <td>${escapeHtml((evalCase?.toolCalls ?? []).join(', ') || 'none')}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

export function renderMacroEvalResults(macroEval: MacroEvalArtifact | null): string {
  if (!macroEval) {
    return '<p class="subtle">No macro eval artifact found; run <span class="mono">fdekit eval macro</span> after lower-level evals.</p>';
  }

  if (macroEval.patterns.length === 0) {
    return '<p class="subtle">No recurring behavior patterns found yet.</p>';
  }

  const focus = macroEval.focusPattern;

  return `<div class="stack">
    ${focus ? `<div class="row-item">
      <div>
        <div class="label">Focus pattern</div>
        <div class="row-main">${escapeHtml(focus.behaviorPattern)}</div>
        <div class="subtle">${escapeHtml(focus.summary)}</div>
      </div>
      ${statusPill(focus.severity)}
    </div>` : ''}
    <table>
      <thead>
        <tr>
          <th>Pattern</th>
          <th>Severity</th>
          <th>Frequency</th>
          <th>Inspect</th>
        </tr>
      </thead>
      <tbody>
        ${macroEval.patterns.slice(0, 6).map((pattern) => `<tr>
          <td>${escapeHtml(pattern.behaviorPattern)}</td>
          <td>${statusPill(pattern.severity === 'high' ? 'failed' : pattern.severity === 'medium' ? 'warn' : 'passed')}</td>
          <td>${pattern.frequency}</td>
          <td>${escapeHtml(pattern.recommendedInspection)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

export function renderPatternReuse(patterns: ReusablePatternItem[]): string {
  if (patterns.length === 0) {
    return '<p class="subtle">No recipe or reuse metadata captured yet.</p>';
  }

  return `<div class="impact-grid">
    ${patterns.map((pattern) => `<article class="impact-card ${escapeHtml(pattern.status)}">
      <div class="event-meta">${escapeHtml(pattern.label)}</div>
      <strong class="impact-value">${escapeHtml(pattern.value)}</strong>
      <div class="event-meta">${escapeHtml(pattern.detail)}</div>
    </article>`).join('')}
  </div>`;
}

export function renderEvalComparison(metrics: ConsoleMetrics): string {
  const suiteRows = metrics.evalSuites.length > 0
    ? `<table>
      <thead><tr><th>Suite</th><th>Status</th><th>Pass rate</th></tr></thead>
      <tbody>
        ${metrics.evalSuites.map((suite) => `<tr>
          <td>${escapeHtml(suite.name)}</td>
          <td>${statusPill(suite.status)}</td>
          <td>${escapeHtml(`${suite.passed}/${suite.cases || 0} passed`)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`
    : '<p class="subtle">No eval suites found yet.</p>';

  return `<div>
    <div class="mini-metrics">
      <div class="mini-metric"><strong>${escapeHtml(`${metrics.evalPassedCases}/${metrics.evalCaseCount || 0}`)}</strong><span class="subtle">cases passed</span></div>
      <div class="mini-metric"><strong>${escapeHtml(String(metrics.snapshotTrend.length))}</strong><span class="subtle">dashboard snapshots</span></div>
      <div class="mini-metric"><strong>${escapeHtml(metrics.evalStatus)}</strong><span class="subtle">latest eval</span></div>
    </div>
    ${suiteRows}
    ${renderSnapshotTrend(metrics.snapshotTrend)}
  </div>`;
}

function renderSnapshotTrend(trend: SnapshotTrendItem[]): string {
  if (trend.length === 0) {
    return '';
  }

  return `<div class="trend" style="margin-top: 12px;">
    ${trend.slice(-6).reverse().map((entry) => `<div class="trend-row">
      <span>${statusPill(entry.evalStatus)}</span>
      <a href="${escapeHtml(entry.file)}">${escapeHtml(formatDate(entry.createdAt))}</a>
      <span class="right">${escapeHtml(String(entry.traceCount))}</span>
    </div>`).join('')}
  </div>`;
}
