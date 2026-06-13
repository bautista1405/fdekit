import type { ConsoleMetrics } from '../interfaces/index.js';
import { escapeHtml } from '../view-models/index.js';

export function renderDemoHero(metrics: ConsoleMetrics): string {
  const nextAction = recommendedNextAction(metrics);

  return `<section class="demo-hero" aria-label="Deployment command center">
    <div class="hero-copy">
      <div class="hero-kicker">Deployment Command Center</div>
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
  if (metrics.evalStatus === 'passed' && !hasOpenGovernanceItems(metrics) && metrics.connectorEvidence.length > 0) {
    return 'Agent run is demo-ready with governed customer-system evidence';
  }

  if (hasOpenGovernanceItems(metrics)) {
    return 'Agent run needs governance review before customer handoff';
  }

  if (metrics.traceCount === 0) {
    return 'Run an agent to populate the deployment story';
  }

  return 'Deployment is captured; add eval and connector evidence to complete the story';
}

function recommendedNextAction(metrics: ConsoleMetrics): string {
  if (metrics.traceCount === 0) {
    return 'Run the recipe once, then rebuild the console to show trace evidence, tool behavior, and artifact outputs';
  }

  if (metrics.evalStatus !== 'passed') {
    return 'Run evals and fix failing cases before using this dashboard as the customer-facing proof point';
  }

  if (metrics.connectorEvidence.length === 0) {
    return 'Enable at least one connector action, such as Slack or issue creation, so the demo proves real workflow automation';
  }

  if (hasOpenGovernanceItems(metrics)) {
    return 'Review approval and policy items, then re-run to demonstrate governance closure';
  }

  if (!metrics.reportReady) {
    return 'Generate the deployment report so the export bundle includes a customer-ready narrative';
  }

  return 'Use this console as the live demo surface, then export Markdown or PDF for the customer handoff';
}

function hasOpenGovernanceItems(metrics: ConsoleMetrics): boolean {
  const latestViolations = Array.isArray(metrics.latestRunSummary?.policyViolations)
    ? metrics.latestRunSummary.policyViolations.length
    : 0;

  return latestViolations > 0 || metrics.approvalQueue.some((approval) => approval.status !== 'approved');
}
