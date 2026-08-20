import * as path from 'path';
import { createConsoleExportBundle, renderConsolePages, type ConsoleHistoryEntry, type ConsoleReview } from '@fdekit/console';
import { prepareConsoleDiffs } from '@fdekit/console/diff';
import type { ReviewArtifact } from '@fdekit/core';
import {
  createArtifactStore,
  loadDeployment,
  readApprovals,
  readAuditLog,
  readJsonArtifact,
  readJsonArtifacts,
  readTextArtifact,
  requireConfigFile,
  writeJsonArtifact,
  writeTextArtifact,
  type EvalArtifact,
  type MacroEvalArtifact,
  type TraceArtifact,
} from '@fdekit/runtime';
import type { CommandContext } from '../context.js';

export async function cmdConsole(ctx: CommandContext): Promise<void> {
  const configPath = await requireConfigFile(ctx.cwd);
  const projectDir = path.dirname(configPath);
  const deployment = await loadDeployment(configPath);
  const artifactStore = createArtifactStore({ deployment, projectDir });
  const latestEval = await readJsonArtifact<EvalArtifact>(projectDir, 'evals', 'latest.json', artifactStore);
  const latestMacroEval = await readJsonArtifact<MacroEvalArtifact>(projectDir, 'evals/macro', 'latest.json', artifactStore);
  const traces = await readJsonArtifacts<TraceArtifact>(projectDir, 'traces', artifactStore);
  const reportMarkdown = await readTextArtifact(projectDir, 'reports', 'deployment-report.md', artifactStore);
  const approvals = await readApprovals(projectDir, artifactStore);
  const auditLog = await readAuditLog(projectDir, artifactStore);
  const reviews = await readReviews(projectDir, artifactStore);
  const createdAt = new Date().toISOString();
  const snapshotFileName = `console-${safeTimestamp(createdAt)}.html`;
  const snapshotRelativePath = `consoles/${snapshotFileName}`;
  const existingHistory = await readJsonArtifact<ConsoleHistoryEntry[]>(projectDir, 'consoles', 'history.json', artifactStore) ?? [];
  const nextHistory = trimHistory([
    ...existingHistory,
    {
      createdAt,
      deployment: deployment.name,
      evalStatus: latestEval?.status ?? 'not run',
      traceCount: traces.length,
      file: snapshotRelativePath.replaceAll(path.sep, '/'),
    },
  ]);
  const consoleData = {
    deployment,
    traces,
    latestEval,
    latestMacroEval,
    reportMarkdown,
    approvals,
    auditLog,
    createdAt,
    history: nextHistory,
    reviews,
  };
  // Diffs are rendered before the synchronous page pass: tokenizing a patch is
  // async, and the section renderers are sync string builders by design.
  const diffs = await prepareConsoleDiffs(consoleData);
  const pages = renderConsolePages(consoleData, { diffs });
  const exportBundle = createConsoleExportBundle({
    deployment,
    traces,
    latestEval,
    latestMacroEval,
    reportMarkdown,
    approvals,
    auditLog,
    createdAt,
    history: nextHistory,
  });

  let consolePath = '';

  for (const page of pages) {
    const pagePath = await writeTextArtifact(projectDir, '', page.fileName, page.html, artifactStore);

    if (page.fileName === 'console.html') {
      consolePath = pagePath;
    }
  }

  const snapshotPath = await writeTextArtifact(projectDir, 'consoles', snapshotFileName, pages[0]?.html ?? '', artifactStore);
  await writeJsonArtifact(projectDir, 'consoles', 'history.json', nextHistory, artifactStore);
  const dashboardCsvPath = await writeTextArtifact(projectDir, 'exports', 'dashboard.csv', exportBundle.dashboardCsv, artifactStore);
  await writeTextArtifact(projectDir, 'exports', 'dashboard.md', exportBundle.summaryMarkdown, artifactStore);
  await writeTextArtifact(projectDir, 'exports', 'dashboard-data.json', exportBundle.dataJson, artifactStore);
  const exportRoot = artifactStore.kind === 'local'
    ? path.dirname(dashboardCsvPath)
    : `${artifactStore.rootUri}/exports`;

  console.log(`Console created: ${consolePath}`);
  console.log(`Console pages: ${pages.map((page) => page.fileName).join(', ')}`);
  console.log(`Console snapshot: ${snapshotPath}`);
  console.log(`Exports written: ${exportRoot}`);
  console.log(`Traces loaded: ${traces.length}`);
  console.log(`Approvals loaded: ${approvals.length}`);
  console.log(`Audit entries loaded: ${auditLog.length}`);
  console.log(`Eval status: ${latestEval?.status ?? 'not run'}`);
}

/**
 * Loads review artifacts together with the diff each one reviewed.
 *
 * The patch lives beside the review as a text artifact (`ReviewArtifact.
 * patchArtifact`, conventionally `<runId>.patch`) so the console can show what
 * the agent actually read without calling back out to the forge. A review
 * written before patch capture simply has no patch and renders findings only.
 */
async function readReviews(
  projectDir: string,
  artifactStore: ReturnType<typeof createArtifactStore>,
): Promise<ConsoleReview[]> {
  const artifacts = await readJsonArtifacts<ReviewArtifact>(projectDir, 'reviews', artifactStore);
  const reviews: ConsoleReview[] = [];

  for (const artifact of artifacts) {
    if (!artifact || typeof artifact.runId !== 'string') {
      continue;
    }

    const fileName = artifact.patchArtifact ?? `${artifact.runId}.patch`;
    const patch = await readTextArtifact(projectDir, 'reviews', fileName, artifactStore);

    reviews.push({ artifact, patch });
  }

  return reviews.sort((left, right) => (right.artifact.createdAt ?? '').localeCompare(left.artifact.createdAt ?? ''));
}

function safeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

function trimHistory(entries: ConsoleHistoryEntry[]): ConsoleHistoryEntry[] {
  const deduped = new Map<string, ConsoleHistoryEntry>();

  for (const entry of entries) {
    deduped.set(entry.file, entry);
  }

  return [...deduped.values()]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-30);
}
