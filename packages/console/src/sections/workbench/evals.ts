import type {
  EvalCaseResult,
  EvalArtifact,
  EvalSuiteResult,
  MacroEvalArtifact,
} from '@fdekit/runtime';
import {
  escapeHtml,
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

  return `<div>
    ${focus ? `<div class="readiness-item">
      <div>${statusPill(focus.severity)}</div>
      <div class="row-main">
        <strong>${escapeHtml(focus.behaviorPattern)}</strong>
        <div class="event-meta">${escapeHtml(focus.summary)}</div>
      </div>
    </div>` : ''}
    <table style="margin-top: 10px;">
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
