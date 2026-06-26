import type {
  ConsoleMetrics,
  PolicyDefinitionItem,
} from '../../interfaces/index.js';
import { asRecord } from '@fdekit/core';
import type { TraceArtifact } from '@fdekit/runtime';
import {
  escapeHtml,
  statusPill,
} from '../../view-models/index.js';

export function renderGovernance(metrics: ConsoleMetrics, traces: TraceArtifact[]): string {
  const policyViolations = traces.flatMap((trace) => (trace.events ?? [])
    .filter((event) => event.type === 'agent.run.completed')
    .flatMap((event) => Array.isArray(event.policyViolations) ? event.policyViolations : []));

  if (policyViolations.length === 0) {
    return `<ul class="summary-list">
      <li><span>Policy evaluations</span><strong>${metrics.policyEvaluations}</strong></li>
      <li><span>Violations</span><strong>0</strong></li>
      <li><span>Latest run</span><strong>${escapeHtml(String(metrics.latestRunSummary?.status ?? 'unknown'))}</strong></li>
    </ul>`;
  }

  return `<table>
    <thead><tr><th>Policy</th><th>Tool</th><th>Reason</th></tr></thead>
    <tbody>
      ${policyViolations.map((violation) => {
        const record = asRecord(violation);
        return `<tr>
          <td>${escapeHtml(String(record.policy ?? 'unknown'))}</td>
          <td>${escapeHtml(String(record.toolName ?? 'unknown'))}</td>
          <td>${escapeHtml(String(record.reason ?? 'no reason'))}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

export function renderPolicyDefinitions(policies: PolicyDefinitionItem[]): string {
  if (policies.length === 0) {
    return '<p class="subtle">No policy helpers are configured yet.</p>';
  }

  return `<table>
    <thead><tr><th>Scope</th><th>Policy</th><th>Kind</th><th>Detail</th></tr></thead>
    <tbody>
      ${policies.map((policy) => `<tr>
        <td>${escapeHtml(policy.scope)}</td>
        <td>
          ${escapeHtml(policy.name)}
          <div class="event-meta">${escapeHtml(policy.description)}</div>
        </td>
        <td>${statusPill(policy.kind)}</td>
        <td>${escapeHtml(policy.detail)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}
