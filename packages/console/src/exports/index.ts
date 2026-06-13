import type { ConsoleData, ConsoleExportBundle, ConsoleMetrics } from '../interfaces/index.js';
import { calculateMetrics, collectEvalCases } from '../view-models/index.js';
import { renderDashboardCsv } from './csv.js';
import { renderExportDataJson } from './json.js';
import { renderExportMarkdown } from './markdown.js';

export function createConsoleExportBundle(data: ConsoleData): ConsoleExportBundle {
  const createdAt = data.createdAt ?? new Date().toISOString();
  return createConsoleExportBundleFromMetrics(data, calculateMetrics(data), createdAt);
}

export function createConsoleExportBundleFromMetrics(
  data: ConsoleData,
  metrics: ConsoleMetrics,
  createdAt: string,
): ConsoleExportBundle {
  const evalCases = collectEvalCases(data.latestEval ?? null);

  return {
    dashboardCsv: renderDashboardCsv(data, metrics, createdAt, evalCases),
    summaryMarkdown: renderExportMarkdown(data, metrics, createdAt),
    dataJson: renderExportDataJson(data, metrics, createdAt, evalCases),
  };
}
