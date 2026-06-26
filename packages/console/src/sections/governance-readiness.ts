import type {
  ConsoleMetrics,
  EnforcementPostureItem,
  FieldMethodItem,
  HarnessSummary,
  IntegrationReadinessItem,
  ProductionReadinessItem,
  WorkflowStepItem,
} from '../interfaces/index.js';
import {
  renderHandoffRow,
  renderReadinessList,
} from './components.js';
import type { DashboardSectionStrategy } from './types.js';
import { escapeHtml, statusPill } from '../view-models/index.js';

export const governanceReadinessSection: DashboardSectionStrategy = {
  id: 'governance-readiness',
  title: 'Readiness',
  navLabel: 'Readiness',
  fileName: 'readiness.html',
  description: 'Workflow, integration status, and production controls.',
  badge: (metrics) => `${metrics.productionReadiness.filter((item) => item.status === 'pass').length}/${metrics.productionReadiness.length} controls ready`,
  render: ({ metrics }) => `<section class="brief-grid" aria-label="Governance and readiness">
        <section class="panel compact-panel">
          <div class="section-head">
            <div>
              <h2>Workflow Map</h2>
              <div class="section-note">Trigger to customer-system handoff.</div>
            </div>
          </div>
          ${renderWorkflowMap(metrics.workflowMap)}
        </section>

        <section class="panel compact-panel">
          <div class="section-head">
            <div>
              <h2>Integration Readiness</h2>
              <div class="section-note">Configured systems versus proven calls.</div>
            </div>
          </div>
          ${renderIntegrationReadiness(metrics.integrationReadiness)}
        </section>

        <section class="panel compact-panel">
          <div class="section-head">
            <div>
              <h2>Deployment Harness</h2>
              <div class="section-note">Governed loop phases, step limits, and control refs.</div>
            </div>
          </div>
          ${renderHarnessSummary(metrics)}
        </section>

        <section class="panel compact-panel">
          <div class="section-head">
            <div>
              <h2>Enforcement Posture</h2>
              <div class="section-note">Runtime edge and governance profile from the reviewed trace.</div>
            </div>
          </div>
          ${renderEnforcementPosture(metrics.enforcementPosture)}
        </section>

        <section class="panel compact-panel">
          <div class="section-head">
            <div>
              <h2>Production Readiness</h2>
              <div class="section-note">Eval, governance, budget, and operational controls.</div>
            </div>
          </div>
          ${renderProductionReadiness(metrics.productionReadiness)}
        </section>
      </section>`,
};

function renderWorkflowMap(steps: WorkflowStepItem[]): string {
  return `<div class="workflow">
    ${steps.map((step, index) => `<div class="workflow-step">
      <div><span class="step-mark ${escapeHtml(step.status)}">${escapeHtml(String(index + 1))}</span></div>
      <div class="row-main">
        <strong>${escapeHtml(step.label)}</strong>
        <div class="event-meta">${escapeHtml(step.detail)}</div>
      </div>
    </div>`).join('')}
  </div>`;
}

function renderIntegrationReadiness(items: IntegrationReadinessItem[]): string {
  return renderReadinessList(items);
}

function renderHarnessSummary(metrics: ConsoleMetrics): string {
  const harness = metrics.harness;

  return `<div class="handoff">
    ${renderHandoffRow('Name', harness.name)}
    ${renderHandoffRow('Purpose', harness.description)}
    ${renderHandoffRow('Max steps', harness.maxSteps)}
    ${renderHandoffRow('Review', harness.review)}
    ${renderHandoffRow('Steering', harness.steer)}
  </div>
  ${renderHarnessLimitInsight(metrics)}
  <h3 class="subsection-title">Phases</h3>
  ${renderHarnessItems(harness.phases)}
  <h3 class="subsection-title">References</h3>
  ${renderHarnessReferences(harness)}`;
}

function renderHarnessLimitInsight(metrics: ConsoleMetrics): string {
  const limitHits = metrics.allRunHistory.filter((run) => {
    const reason = run.failureReason?.toLowerCase() ?? '';

    return run.failureCategory === 'max-steps'
      || reason.includes('tool call limit')
      || reason.includes('max steps')
      || reason.includes('maximum steps');
  });

  if (limitHits.length === 0) {
    return '';
  }

  const message = `Run history includes ${limitHits.length} harness/tool-limit stop(s); compare against max ${metrics.harness.maxSteps} step(s) and phase limits below.`;

  return `<p class="subtle">${escapeHtml(message)}</p>`;
}

function renderHarnessReferences(harness: HarnessSummary): string {
  if (harness.references.length === 0) {
    return '<p class="subtle">No harness references configured yet.</p>';
  }

  return renderHarnessItems(harness.references);
}

function renderHarnessItems(items: FieldMethodItem[]): string {
  return `<div class="readiness-list">
    ${items.map((item) => `<div class="readiness-item">
      <div>${statusPill(item.status)}</div>
      <div class="row-main">
        <strong>${escapeHtml(item.label)}</strong>
        <div class="event-meta">${escapeHtml(item.detail)}</div>
        <div class="event-meta">${escapeHtml(item.value)}</div>
      </div>
    </div>`).join('')}
  </div>`;
}

function renderEnforcementPosture(items: EnforcementPostureItem[]): string {
  return renderReadinessList(items);
}

function renderProductionReadiness(items: ProductionReadinessItem[]): string {
  return renderReadinessList(items);
}
