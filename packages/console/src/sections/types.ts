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
  /** Optional short status summary shown in the page header meta (e.g. "5/6 ready"). */
  badge?: (metrics: ConsoleMetrics) => string;
  render: (context: DashboardSectionContext) => string;
}
