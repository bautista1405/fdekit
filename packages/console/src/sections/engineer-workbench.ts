import { renderDetailPanel } from './components.js';
import type { DashboardSectionStrategy } from './types.js';
import {
  renderEvalResults,
  renderMacroEvalResults,
} from './workbench/evals.js';
import {
  renderCreatedIssues,
  renderApprovalQueue,
  renderSlackMessages,
} from './workbench/external-actions.js';
import {
  renderGovernance,
  renderPolicyDefinitions,
} from './workbench/governance.js';
import {
  renderRunStory,
} from './workbench/traces.js';
import type { EvalArtifact, MacroEvalArtifact } from '@fdekit/runtime';
import type { ConsoleMetrics } from '../interfaces/index.js';
import {
  escapeHtml,
  isProvenConnectorEvidence,
  selectReviewTraces,
  statusPill,
} from '../view-models/index.js';

export const engineerWorkbenchSection: DashboardSectionStrategy = {
  id: 'engineer-workbench',
  title: 'Engineer Review',
  navLabel: 'Review',
  fileName: 'workbench.html',
  description: 'Trace, eval, governance, evidence, and report.',
  badge: (metrics) => reviewTraceLabel(metrics),
  render: ({ data, metrics }) => `<section class="workbench" aria-label="Engineer workbench">
        <div class="detail-stack">
          ${renderDetailPanel('Review Gates', renderReviewGates(metrics), true)}
          ${renderDetailPanel('Latest Run Story', renderRunStory(metrics.latestTrace), true)}
          ${renderDetailPanel('Eval Results', renderEvalDetail(data.latestEval ?? null, data.latestMacroEval ?? null), true)}
        </div>

        <div class="detail-stack">
          ${renderDetailPanel('Governance Review', `${renderGovernance(metrics, selectReviewTraces(data))}<h3 class="subsection-title">Approval Queue</h3>${renderApprovalQueue(metrics.approvalQueue)}<h3 class="subsection-title">Policy-as-Code</h3>${renderPolicyDefinitions(metrics.policyDefinitions)}`, true)}
          ${renderDetailPanel('Customer Evidence', `${renderCustomerAnswer(metrics)}<h3 class="subsection-title">Created Issues</h3>${renderCreatedIssues(metrics.createdIssues, 3)}<h3 class="subsection-title">Slack Notifications</h3>${renderSlackMessages(metrics.slackMessages, 3)}`, true)}
          ${renderDetailPanel('Customer Report', `<pre class="report">${escapeHtml(data.reportMarkdown?.trim() || 'No report has been created yet')}</pre>`, true)}
        </div>
      </section>`,
};

function reviewTraceLabel(metrics: ConsoleMetrics): string {
  if (metrics.traceScope === 'latest_eval') {
    return `${metrics.traceCount} latest eval run(s)`;
  }

  if (metrics.traceScope === 'latest_run') {
    return `${metrics.traceCount} latest run`;
  }

  return `${metrics.traceCount} run artifacts`;
}

function renderReviewGates(metrics: ConsoleMetrics): string {
  const approvedCount = metrics.approvalQueue.filter((approval) => approval.status === 'approved').length;
  const openApprovals = metrics.approvalQueue.length - approvedCount;
  const productionReady = metrics.productionReadiness.filter((item) => item.status === 'pass').length;
  const measuredEvidenceCount = metrics.connectorEvidence.filter(isProvenConnectorEvidence).length;

  return `<div class="review-gates">
    <div class="review-gate">
      <span>Eval</span>
      ${statusPill(metrics.evalStatus)}
      <strong>${escapeHtml(`${metrics.evalPassedCases}/${metrics.evalCaseCount || 0}`)}</strong>
    </div>
    <div class="review-gate">
      <span>Governance</span>
      ${statusPill(metrics.policyViolationCount > 0 || openApprovals > 0 ? 'warn' : 'pass')}
      <strong>${escapeHtml(`${metrics.policyViolationCount} violation(s)`)}</strong>
    </div>
    <div class="review-gate">
      <span>Evidence</span>
      ${statusPill(measuredEvidenceCount > 0 ? 'pass' : 'warn')}
      <strong>${escapeHtml(`${measuredEvidenceCount} verified system call(s)`)}</strong>
    </div>
    <div class="review-gate">
      <span>Production</span>
      ${statusPill(productionReady === metrics.productionReadiness.length ? 'pass' : 'warn')}
      <strong>${escapeHtml(`${productionReady}/${metrics.productionReadiness.length}`)}</strong>
    </div>
  </div>`;
}

function renderEvalDetail(
  evalArtifact: EvalArtifact | null,
  macroEval: MacroEvalArtifact | null,
): string {
  if (!macroEval || macroEval.patterns.length === 0) {
    return renderEvalResults(evalArtifact);
  }

  return `${renderEvalResults(evalArtifact)}<h3 class="subsection-title">Behavior Patterns</h3>${renderMacroEvalResults(macroEval)}`;
}

function renderCustomerAnswer(metrics: ConsoleMetrics): string {
  return `<div class="handoff customer-answer">
    <div class="handoff-row">
      <div class="row-label">Final</div>
      <div class="row-main">${escapeHtml(metrics.finalAnswer ?? 'No final answer captured yet')}</div>
    </div>
  </div>`;
}
