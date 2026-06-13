import { renderCharts, renderGovernancePosture } from './charts.js';
import type { DashboardSectionStrategy } from './types.js';

export const chartsAndPostureSection: DashboardSectionStrategy = {
  id: 'charts-and-governance-posture',
  title: 'Deployment Charts',
  navLabel: 'Charts',
  fileName: 'charts.html',
  description: 'Metric shape, action mix, latency, and governance posture.',
  render: ({ metrics }) => `<section class="panel charts-panel">
        <h2>Deployment Charts</h2>
        ${renderCharts(metrics)}
      </section>

      <section class="panel charts-panel">
        <h2>Governance Posture</h2>
        ${renderGovernancePosture(metrics.governancePosture)}
      </section>`,
};
