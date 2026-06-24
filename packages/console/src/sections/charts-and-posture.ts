import { renderCharts, renderGovernancePosture } from './charts.js';
import type { DashboardSectionStrategy } from './types.js';

export const chartsAndPostureSection: DashboardSectionStrategy = {
  id: 'charts-and-governance-posture',
  title: 'Signals',
  navLabel: 'Signals',
  fileName: 'charts.html',
  description: 'Eval shape, action mix, latency, and controls.',
  render: ({ metrics }) => `<section class="panel charts-panel">
        <h2>Signals</h2>
        ${renderCharts(metrics)}
      </section>

      <section class="panel charts-panel">
        <h2>Controls</h2>
        ${renderGovernancePosture(metrics.governancePosture)}
      </section>`,
};
