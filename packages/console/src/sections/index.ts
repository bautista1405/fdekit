import { chartsAndPostureSection } from './charts-and-posture.js';
import { engineerWorkbenchSection } from './engineer-workbench.js';
import { executiveBriefSection } from './executive-brief.js';
import { governanceReadinessSection } from './governance-readiness.js';
import type { DashboardSectionContext, DashboardSectionStrategy } from './types.js';

export { renderKpi, renderNavGroup } from './components.js';
export { renderDemoHero } from './hero.js';
export type { DashboardSectionContext, DashboardSectionStrategy } from './types.js';

export const dashboardSectionStrategies: DashboardSectionStrategy[] = [
  executiveBriefSection,
  governanceReadinessSection,
  chartsAndPostureSection,
  engineerWorkbenchSection,
];

export function renderDashboardSections(context: DashboardSectionContext): string {
  return dashboardSectionStrategies.map((strategy) => strategy.render(context)).join('\n');
}
