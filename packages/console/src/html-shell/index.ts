import { createConsoleExportBundleFromMetrics } from '../exports/index.js';
import { dashboardStyles } from './styles.js';
import type { ConsoleData, ConsoleMetrics, ConsolePage } from '../interfaces/index.js';
import {
  calculateMetrics,
  escapeHtml,
  formatDate,
  isProvenConnectorEvidence,
  scriptJson,
  statusPill,
} from '../view-models/index.js';
import {
  dashboardSectionStrategies,
  renderDemoHero,
  renderKpi,
  renderNavGroup,
} from '../sections/index.js';
import type { DashboardSectionContext } from '../sections/index.js';

interface ConsoleNavItem {
  id: string;
  label: string;
  fileName: string;
  description: string;
}

interface ConsoleShellOptions {
  data: ConsoleData;
  metrics: ConsoleMetrics;
  createdAt: string;
  activeId: string;
  pageTitle: string;
  pageDescription: string;
  pageBadge?: string;
  content: string;
  navItems: ConsoleNavItem[];
  exportPayload: string;
}

const overviewNavItem: ConsoleNavItem = {
  id: 'overview',
  label: 'Overview',
  fileName: 'console.html',
  description: 'Status verdict, key results, and next action.',
};

export function renderConsole(data: ConsoleData): string {
  return renderConsolePages(data)[0]?.html ?? '';
}

export function renderConsolePages(data: ConsoleData): ConsolePage[] {
  const createdAt = data.createdAt ?? new Date().toISOString();
  const pageData: ConsoleData = { ...data, createdAt };
  const metrics = calculateMetrics(pageData);
  const exportBundle = createConsoleExportBundleFromMetrics(pageData, metrics, createdAt);
  const exportPayload = scriptJson({
    dashboardCsv: {
      fileName: 'fdekit-dashboard.csv',
      mime: 'text/csv;charset=utf-8',
      contents: exportBundle.dashboardCsv,
    },
    summaryMarkdown: {
      fileName: 'fdekit-dashboard.md',
      mime: 'text/markdown;charset=utf-8',
      contents: exportBundle.summaryMarkdown,
    },
    dataJson: {
      fileName: 'fdekit-dashboard-data.json',
      mime: 'application/json;charset=utf-8',
      contents: exportBundle.dataJson,
    },
  });
  const navItems = [
    overviewNavItem,
    ...dashboardSectionStrategies.map((section) => ({
      id: section.id,
      label: section.navLabel,
      fileName: section.fileName,
      description: section.description,
    })),
  ];
  const context: DashboardSectionContext = { data: pageData, metrics };

  return [
    {
      fileName: overviewNavItem.fileName,
      title: 'Overview',
      html: renderConsoleShell({
        data: pageData,
        metrics,
        createdAt,
        activeId: overviewNavItem.id,
        pageTitle: 'Overview',
        pageDescription: overviewNavItem.description,
        content: renderOverviewPage(metrics, navItems),
        navItems,
        exportPayload,
      }),
    },
    ...dashboardSectionStrategies.map((section) => ({
      fileName: section.fileName,
      title: section.title,
      html: renderConsoleShell({
        data: pageData,
        metrics,
        createdAt,
        activeId: section.id,
        pageTitle: section.title,
        pageDescription: section.description,
        pageBadge: section.badge?.(metrics),
        content: section.render(context),
        navItems,
        exportPayload,
      }),
    })),
  ];
}

function renderOverviewPage(metrics: ConsoleMetrics, navItems: ConsoleNavItem[]): string {
  const provenEvidenceCount = metrics.connectorEvidence.filter(isProvenConnectorEvidence).length;
  const failedMeasuredCount = metrics.connectorEvidence.filter((item) => (
    item.evidenceKind === 'measured' && item.status === 'failed'
  )).length;
  const simulatedEvidenceCount = metrics.connectorEvidence.filter((item) => item.evidenceKind === 'simulated').length;
  const actionCount = metrics.createdIssues.length + metrics.slackMessages.length;
  const signalStatus = (label: string): 'pass' | 'warn' | 'fail' | undefined => (
    metrics.readinessSignals.find((signal) => signal.label === label)?.status
  );

  return `${renderDemoHero(metrics)}

      <section class="kpis" aria-label="Key results">
        ${renderKpi('Eval', metrics.evalStatus, `${metrics.evalPassedCases}/${metrics.evalCaseCount || 0} cases passed`, signalStatus('Evals'))}
        ${renderKpi('Reviewed run', String(metrics.traceCount), traceScopeDetail(metrics), signalStatus('Trace Evidence'))}
        ${renderKpi('Reliability', `${metrics.completedRunCount}/${metrics.totalRunCount}`, reliabilityDetail(metrics), metrics.reliabilityStatus)}
        ${renderKpi('Evidence', String(provenEvidenceCount), `${failedMeasuredCount} failed measured event(s), ${simulatedEvidenceCount} simulated event(s)`, signalStatus('Customer Systems'))}
        ${renderKpi('Governance', String(metrics.policyEvaluations), `${metrics.policyDefinitions.length} policy file item(s), ${metrics.policyViolationCount} violation(s)`, signalStatus('Governance'))}
        ${renderKpi('Handoff', String(actionCount), `${metrics.reportReady ? 'report ready' : 'report pending'}, ${Math.round(metrics.avgLatencyMs)}ms avg latency`, signalStatus('Customer Report'))}
      </section>

      <section class="section-cards" aria-label="Console pages">
        ${navItems.slice(1).map((item) => `<a class="section-card" href="${escapeHtml(item.fileName)}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.description)}</strong>
          <small>Open page</small>
        </a>`).join('')}
      </section>`;
}

function traceScopeDetail(metrics: ConsoleMetrics): string {
  if (metrics.traceScope === 'latest_eval') {
    return `${metrics.allTraceCount} total trace artifacts retained`;
  }

  if (metrics.traceScope === 'latest_run') {
    return `${metrics.allTraceCount} stored trace artifacts available`;
  }

  return 'trace artifacts captured';
}

function reliabilityDetail(metrics: ConsoleMetrics): string {
  if (metrics.totalRunCount === 0) {
    return 'No stored run history captured';
  }

  return `${Math.round(metrics.successRate * 100)}% runs completed across stored history`;
}

function renderConsoleShell(options: ConsoleShellOptions): string {
  const deployment = options.data.deployment;
  const providerNames = Object.keys(deployment.providers ?? {});
  const connectorNames = Object.keys(deployment.connectors ?? {});
  const agentNames = Object.keys(deployment.agents ?? {});

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FDEKit Console - ${escapeHtml(deployment.name)} - ${escapeHtml(options.pageTitle)}</title>
  <style>${dashboardStyles}</style>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="app">
    <aside>
      <div class="brand">
        <span class="brand-mark">F</span>
        <span>FDEKit Console</span>
      </div>
      ${renderSidebarReview(options.metrics)}
      ${renderPageNavigation(options.navItems, options.activeId)}
      <div class="sidebar-meta">
        ${renderNavGroup('Deployment', [deployment.name, deployment.environment ?? 'local'])}
        ${renderNavGroup('Providers', providerNames)}
        ${renderNavGroup('Connectors', connectorNames)}
        ${renderNavGroup('Agents', agentNames)}
      </div>
    </aside>
    <main id="main-content">
      <div class="topbar">
        <div class="page-heading">
          <div class="page-kicker">${escapeHtml(deployment.name)}</div>
          <h1>${escapeHtml(options.pageTitle)}</h1>
          <p class="subtle">${escapeHtml(options.pageDescription)}</p>
          <div class="page-meta">
            <span>Created ${escapeHtml(formatDate(options.createdAt))}</span>
            <span>${escapeHtml(reviewScopeLabel(options.metrics))}</span>
            ${options.pageBadge ? `<span class="page-meta-badge">${escapeHtml(options.pageBadge)}</span>` : ''}
          </div>
        </div>
        <div class="topbar-actions">
          ${statusPill(options.metrics.evalStatus)}
          <div class="export-actions" aria-label="Export dashboard data">
            <button class="export-button" type="button" onclick="downloadExport('dashboardCsv')">CSV</button>
            <button class="export-button" type="button" onclick="downloadExport('summaryMarkdown')">Markdown</button>
            <button class="export-button" type="button" onclick="downloadExport('dataJson')">JSON</button>
            <button class="export-button" type="button" onclick="window.print()">PDF</button>
          </div>
        </div>
      </div>

      ${options.content}
    </main>
  </div>
  <script>
    const fdekitExports = ${options.exportPayload};

    function downloadExport(key) {
      const item = fdekitExports[key];
      if (!item) return;
      const blob = new Blob([item.contents], { type: item.mime });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = item.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>
`;
}

function renderSidebarReview(metrics: ConsoleMetrics): string {
  const actionCount = metrics.createdIssues.length + metrics.slackMessages.length;

  return `<div class="sidebar-review" aria-label="Review snapshot">
    ${renderSidebarReviewRow('Scope', escapeHtml(reviewScopeLabel(metrics)))}
    ${renderSidebarReviewRow('Reviewed', escapeHtml(String(metrics.traceCount)))}
    ${renderSidebarReviewRow('Eval', statusPill(metrics.evalStatus))}
    ${renderSidebarReviewRow('Actions', escapeHtml(String(actionCount)))}
  </div>`;
}

function renderSidebarReviewRow(label: string, valueHtml: string): string {
  return `<div class="sidebar-review-row">
    <span>${escapeHtml(label)}</span>
    <strong>${valueHtml}</strong>
  </div>`;
}

function reviewScopeLabel(metrics: ConsoleMetrics): string {
  if (metrics.traceScope === 'latest_eval') {
    return 'Latest eval scope';
  }

  if (metrics.traceScope === 'latest_run') {
    return 'Latest run scope';
  }

  return 'All traces scope';
}

function renderPageNavigation(items: ConsoleNavItem[], activeId: string): string {
  return `<nav class="page-nav" aria-label="Console sections">
    ${items.map((item) => {
      const active = item.id === activeId;

      return `<a class="nav-link${active ? ' active' : ''}" href="${escapeHtml(item.fileName)}"${active ? ' aria-current="page"' : ''}>
        <span>${escapeHtml(item.label)}</span>
        <small>${escapeHtml(item.description)}</small>
      </a>`;
    }).join('')}
  </nav>`;
}
