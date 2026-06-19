import type {
  BusinessImpactItem,
  ConnectorEvidence,
  ConsoleMetrics,
  FieldMethodSummary,
} from '../interfaces/index.js';
import { renderHandoffRow } from './components.js';
import type { DashboardSectionStrategy } from './types.js';
import {
  collectGenericConnectorEvidence,
  escapeHtml,
  isProvenConnectorEvidence,
  linkLabel,
  shortId,
  statusPill,
} from '../view-models/index.js';

export const executiveBriefSection: DashboardSectionStrategy = {
  id: 'executive-brief',
  title: 'Executive Brief',
  navLabel: 'Brief',
  fileName: 'brief.html',
  description: 'Outcome, customer-system proof, and latest handoff.',
  render: ({ metrics }) => {
    const connectorEvidence = collectGenericConnectorEvidence(metrics.connectorEvidence);
    const provenEvidenceCount = connectorEvidence.filter(isProvenConnectorEvidence).length;
    const failedMeasuredCount = connectorEvidence.filter((item) => (
      item.evidenceKind === 'measured' && item.status === 'failed'
    )).length;
    const simulatedEvidenceCount = connectorEvidence.filter((item) => item.evidenceKind === 'simulated').length;

    return `<div class="section-titlebar">
        <div>
          <h2>Executive Brief</h2>
          <p>Outcome, handoff, and customer-system proof for the business and technical sponsor.</p>
        </div>
        <span class="pill info">${escapeHtml(`${metrics.createdIssues.length + metrics.slackMessages.length} actions`)}</span>
      </div>
      <section class="brief-grid" aria-label="Executive brief">
        <section class="panel compact-panel">
          <div class="section-head">
            <div>
              <h2>Business Impact</h2>
              <div class="section-note">Operational signal, not generic model telemetry.</div>
            </div>
          </div>
          ${renderBusinessImpact(metrics.businessImpact)}
        </section>

        <section class="panel compact-panel">
          <div class="section-head">
            <div>
              <h2>Field Method</h2>
              <div class="section-note">Workflow, baseline, target, and rollout.</div>
            </div>
            <span class="pill info">${escapeHtml(metrics.fieldMethod.rolloutStage)}</span>
          </div>
          ${renderFieldMethodSummary(metrics.fieldMethod)}
        </section>

        <section class="panel compact-panel">
          <div class="section-head">
            <div>
              <h2>Latest Handoff</h2>
              <div class="section-note">Final answer, external actions, and quality status.</div>
            </div>
            ${statusPill(metrics.evalStatus)}
          </div>
          ${renderHandoff(metrics)}
        </section>

        <section class="panel compact-panel">
          <div class="section-head">
            <div>
              <h2>Connector Evidence</h2>
              <div class="section-note">${escapeHtml(`${provenEvidenceCount} proven action(s), ${failedMeasuredCount} failed measured event(s), ${simulatedEvidenceCount} simulated event(s)`)}</div>
            </div>
          </div>
          ${renderConnectorEvidence(connectorEvidence)}
        </section>
      </section>`;
  },
};

function renderBusinessImpact(items: BusinessImpactItem[]): string {
  return `<div class="impact-grid">
    ${items.map((item) => `<article class="impact-card ${escapeHtml(item.status)}">
      <div class="event-meta">${escapeHtml(item.label)}</div>
      <strong class="impact-value">${escapeHtml(item.value)}</strong>
      <div class="event-meta">${escapeHtml(item.detail)}</div>
    </article>`).join('')}
  </div>`;
}

function renderFieldMethodSummary(fieldMethod: FieldMethodSummary): string {
  return `<div class="handoff">
    ${renderHandoffRow('Workflow', fieldMethod.workflowName)}
    ${renderHandoffRow('Owner', fieldMethod.owner)}
    ${renderHandoffRow('Current', fieldMethod.currentState)}
    ${renderHandoffRow('Target', fieldMethod.target || fieldMethod.targetState)}
    ${renderHandoffRow('Next', fieldMethod.rolloutNext)}
  </div>`;
}

function renderHandoff(metrics: ConsoleMetrics): string {
  const latestIssue = metrics.createdIssues.at(-1);
  const latestSlack = metrics.slackMessages.at(-1);

  return `<div class="handoff">
    ${renderHandoffRow('Final', metrics.finalAnswer ?? 'No final answer captured yet')}
    ${renderHandoffRow('Issue', latestIssue
      ? `${latestIssue.tracker} ${latestIssue.id}: ${latestIssue.title}`
      : 'No issue creation captured yet')}
    ${renderHandoffRow('Slack', latestSlack
      ? `${latestSlack.channel}: ${latestSlack.text}`
      : 'No Slack notification captured yet')}
    ${renderHandoffRow('Quality', `${metrics.evalStatus}; ${metrics.policyViolationCount} policy violation(s)`)}
  </div>`;
}

function renderConnectorEvidence(evidence: ConnectorEvidence[]): string {
  if (evidence.length === 0) {
    return '<p class="subtle">No connector evidence captured yet; run a recipe with Slack, issue tracker, database, codebase, or customer API tools.</p>';
  }

  return `<div>
    ${evidence.slice(-8).reverse().map((item) => `<div class="evidence-row">
      <div><span class="evidence-badge">${escapeHtml(item.connector)}</span></div>
      <div class="row-main">
        <strong>${escapeHtml(item.title)}</strong>
        <div class="event-meta">${escapeHtml(item.detail)}</div>
        <div class="event-meta">${escapeHtml([item.toolName, item.mode, shortId(item.traceId)].filter(Boolean).join(' - '))}${item.url ? ` - <a href="${escapeHtml(item.url)}">${escapeHtml(linkLabel(item.url))}</a>` : ''}</div>
      </div>
    </div>`).join('')}
  </div>`;
}
