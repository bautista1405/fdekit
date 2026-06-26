import { renderCharts, renderGovernancePosture } from './charts.js';
import { renderRunHistory, renderRunLatencyStats, renderToolBars } from './workbench/operations.js';
import type { DashboardSectionStrategy } from './types.js';

export const chartsAndPostureSection: DashboardSectionStrategy = {
  id: 'charts-and-governance-posture',
  title: 'Signals',
  navLabel: 'Signals',
  fileName: 'charts.html',
  description: 'Eval shape, action mix, latency, and controls.',
  render: ({ metrics }) => `<section class="panel charts-panel">
        ${renderCharts(metrics)}
      </section>

      <section class="panel">
        <div class="section-head">
          <div>
            <h2>Operations</h2>
            <div class="section-note">Latency, cost, and tool work behind the run.</div>
          </div>
          <span class="pill info">${metrics.allRunHistory.length} run(s)</span>
        </div>
        ${renderRunLatencyStats(metrics.allRunHistory)}
        <div class="ops-grid">
          <div>
            <h3 class="subsection-title">Tool latency (reviewed run)</h3>
            ${renderToolBars(metrics.toolCounts)}
          </div>
          <div>
            <h3 class="subsection-title">Run history</h3>
            ${renderRunHistory(metrics.allRunHistory)}
          </div>
        </div>
      </section>

      <section class="panel charts-panel">
        <h2>Controls</h2>
        ${renderGovernancePosture(metrics.governancePosture)}
      </section>`,
};
