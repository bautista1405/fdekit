import type {
  FieldMethodItem,
  FieldMethodSummary,
  HarnessSummary,
} from '../../interfaces/index.js';
import {
  renderHandoffRow,
  renderReadinessList,
} from '../components.js';
import { escapeHtml } from '../../view-models/index.js';

export function renderFieldMethodList(items: FieldMethodItem[]): string {
  if (items.length === 0) {
    return '<p class="subtle">No field-method metadata configured yet.</p>';
  }

  return renderReadinessList(items);
}

export function renderRolloutPlan(fieldMethod: FieldMethodSummary): string {
  const stages = fieldMethod.rolloutStages.length > 0
    ? fieldMethod.rolloutStages
    : [fieldMethod.rolloutStage];

  return `<div>
    <div class="handoff">
      ${renderHandoffRow('Current stage', fieldMethod.rolloutStage)}
      ${renderHandoffRow('Next step', fieldMethod.rolloutNext)}
    </div>
    <div class="workflow">
      ${stages.map((stage, index) => `<div class="workflow-step">
        <div><span class="step-mark ${stage === fieldMethod.rolloutStage ? 'pass' : 'warn'}">${escapeHtml(String(index + 1))}</span></div>
        <div class="row-main">
          <strong>${escapeHtml(stage)}</strong>
          <div class="event-meta">${escapeHtml(stage === fieldMethod.rolloutStage ? 'Current rollout stage' : 'Planned rollout stage')}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

export function renderHarnessSummary(harness: HarnessSummary): string {
  const phaseRows = harness.phases.length > 0
    ? renderFieldMethodList(harness.phases)
    : '<p class="subtle">No harness phases configured yet.</p>';
  const referenceRows = harness.references.length > 0
    ? `<h3 class="subsection-title">Referenced Controls</h3>${renderFieldMethodList(harness.references)}`
    : '';

  return `<div>
    <div class="handoff">
      ${renderHandoffRow('Harness', harness.name)}
      ${renderHandoffRow('Purpose', harness.description)}
      ${renderHandoffRow('Max steps', harness.maxSteps)}
      ${renderHandoffRow('Review', harness.review)}
      ${renderHandoffRow('Steering', harness.steer)}
      ${renderHandoffRow('Artifact refs', harness.artifactRefs.join(', ') || 'not configured')}
    </div>
    <h3 class="subsection-title">Phases</h3>
    ${phaseRows}
    ${referenceRows}
  </div>`;
}
