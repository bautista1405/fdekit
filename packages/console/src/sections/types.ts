import type { ConsoleData, ConsoleMetrics } from '../interfaces/index.js';

export interface DashboardSectionContext {
  data: ConsoleData;
  metrics: ConsoleMetrics;
}

export interface DashboardSectionStrategy {
  id: string;
  title: string;
  navLabel: string;
  fileName: string;
  description: string;
  render: (context: DashboardSectionContext) => string;
}
