import type {
  IntegrationReadinessItem,
  ProductionReadinessItem,
  WorkflowStepItem,
} from '../interfaces/index.js';
import {
  renderReadinessList,
} from './components.js';
import type { DashboardSectionStrategy } from './types.js';
import { escapeHtml } from '../view-models/index.js';

export const governanceReadinessSection: DashboardSectionStrategy = {
  id: 'governance-readiness',
  title: 'Governance & Readiness',
  navLabel: 'Readiness',
  fileName: 'readiness.html',
  description: 'Workflow map, integration status, and production controls.',
  render: ({ metrics }) => `<div class="section-titlebar">
        <div>
          <h2>Governance & Readiness</h2>
          <p>Whether the deployment is wired, governed, and explainable enough for a regulated customer environment.</p>
        </div>
        <span class="pill">${escapeHtml(`${metrics.productionReadiness.filter((item) => item.status === 'pass').length}/${metrics.productionReadiness.length} ready`)}</span>
      </div>
      <section class="brief-grid" aria-label="Governance and readiness">
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

function renderProductionReadiness(items: ProductionReadinessItem[]): string {
  return renderReadinessList(items);
}
