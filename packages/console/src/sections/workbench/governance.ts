import type {
  BudgetCapItem,
  ConsoleMetrics,
  PolicyDefinitionItem,
} from '../../interfaces/index.js';
import { asRecord } from '@fdekit/core';
import type {
  AuditLogEntry,
  TraceArtifact,
} from '@fdekit/runtime';
import {
  escapeHtml,
  formatDate,
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

export function renderBudgetCaps(budgets: BudgetCapItem[], totalCostUsd: number): string {
  if (budgets.length === 0) {
    return '<p class="subtle">No budget cap policy found.</p>';
  }

  return `<div>
    ${budgets.map((budget) => {
      const usedPercent = budget.maxUsd > 0 ? Math.min((totalCostUsd / budget.maxUsd) * 100, 100) : 0;
      return `<div class="bar-row">
        <span class="mono">${escapeHtml(budget.scope)}</span>
        <span class="track"><span class="bar" style="width: ${Math.round(usedPercent)}%"></span></span>
        <span class="right">${escapeHtml(`$${budget.maxUsd.toFixed(2)}`)}</span>
      </div>
      <div class="event-meta">${escapeHtml(`${budget.policy}: $${totalCostUsd.toFixed(4)} used`)}</div>`;
    }).join('')}
  </div>`;
}

export function renderAuditLog(entries: AuditLogEntry[]): string {
  if (entries.length === 0) {
    return '<p class="subtle">No audit log entries captured yet.</p>';
  }

  return `<table>
    <thead><tr><th>Time</th><th>Outcome</th><th>Action</th><th>Detail</th></tr></thead>
    <tbody>
      ${entries.slice(-8).reverse().map((entry) => `<tr>
        <td>
          ${escapeHtml(formatDate(entry.createdAt))}
          <div class="event-meta">${escapeHtml(entry.actor)}</div>
        </td>
        <td>${statusPill(entry.outcome)}</td>
        <td class="mono">${escapeHtml(entry.action)}</td>
        <td>${escapeHtml([
          entry.toolName,
          entry.policy,
          entry.approvalId,
          entry.message,
        ].filter(Boolean).join(' - ') || 'recorded')}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}
