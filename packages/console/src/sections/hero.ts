import type { ConsoleMetrics } from '../interfaces/index.js';
import { escapeHtml, isProvenConnectorEvidence } from '../view-models/index.js';

export function renderDemoHero(metrics: ConsoleMetrics): string {
  const nextAction = recommendedNextAction(metrics);

  return `<section class="demo-hero" aria-label="Deployment command center">
    <div class="hero-copy">
      <div class="hero-kicker">Execution Summary</div>
      <h2 class="hero-title">${escapeHtml(commandCenterHeadline(metrics))}</h2>
      <p>${escapeHtml(nextAction)}</p>
      <div class="signal-grid">
        ${metrics.readinessSignals.map((signal) => `<div class="signal ${escapeHtml(signal.status)}">
          <div class="signal-title">${escapeHtml(signal.label)}</div>
          <div class="signal-detail">${escapeHtml(signal.detail)}</div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
}

function commandCenterHeadline(metrics: ConsoleMetrics): string {
  if (metrics.evalStatus === 'passed' && !hasOpenGovernanceItems(metrics) && hasMeasuredConnectorEvidence(metrics)) {
    return 'Run is ready for stakeholder review with governed system evidence';
  }

  if (hasOpenGovernanceItems(metrics)) {
    return 'Governance review is required before stakeholder handoff';
  }

  if (metrics.traceCount === 0) {
    return 'No reviewed execution has been captured yet';
  }

  return 'Execution evidence is captured; eval and connector proof are incomplete';
}

function recommendedNextAction(metrics: ConsoleMetrics): string {
  if (metrics.traceCount === 0) {
    return 'Complete a governed execution and refresh this report to show trace evidence, tool behavior, and artifact outputs';
  }

  if (metrics.evalStatus !== 'passed') {
    return 'Resolve missing or failing eval results before presenting this report as stakeholder evidence';
  }

  if (!hasMeasuredConnectorEvidence(metrics)) {
    return 'Capture at least one verified system action, such as issue creation or Slack notification, before handoff';
  }

  if (hasOpenGovernanceItems(metrics)) {
    return 'Resolve approval and policy items, then refresh the report to show governance closure';
  }

  if (!metrics.reportReady) {
    return 'Generate the deployment report so the export bundle includes a stakeholder-ready narrative';
  }

  return 'Use the exports or print view for stakeholder handoff';
}

function hasMeasuredConnectorEvidence(metrics: ConsoleMetrics): boolean {
  return metrics.connectorEvidence.some(isProvenConnectorEvidence);
}

function hasOpenGovernanceItems(metrics: ConsoleMetrics): boolean {
  const latestViolations = Array.isArray(metrics.latestRunSummary?.policyViolations)
    ? metrics.latestRunSummary.policyViolations.length
    : 0;

  return latestViolations > 0 || metrics.approvalQueue.some((approval) => approval.status !== 'approved');
}
