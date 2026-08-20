import type { PreparedConsoleDiffs } from '../diff/prepare.js';
import type { ConsoleData, ConsoleMetrics } from '../interfaces/index.js';

export interface DashboardSectionContext {
  data: ConsoleData;
  metrics: ConsoleMetrics;
  /**
   * Diffs rendered ahead of this synchronous pass by `prepareConsoleDiffs`.
   * Absent when the caller did not prepare them; sections must degrade rather
   * than assume they exist.
   */
  diffs?: PreparedConsoleDiffs;
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
