import type { ConsoleData, ConsoleMetrics } from '../interfaces/index.js';
import { collectGenericConnectorEvidence, markdownCell } from '../view-models/index.js';

export function renderExportMarkdown(
  data: ConsoleData,
  metrics: ConsoleMetrics,
  createdAt: string,
): string {
  const connectorEvidence = collectGenericConnectorEvidence(metrics.connectorEvidence);
  const lines = [
    `# ${data.deployment.name} Dashboard Export`,
    '',
    `Created: ${createdAt}`,
    `Environment: ${data.deployment.environment ?? 'local'}`,
    '',
    '## Summary',
    '',
    `- Deployment health score: ${metrics.readinessScore}/100 (${metrics.healthStatus}; reliability ${Math.round(metrics.successRate * 100)}%, fleet p95 latency ${Math.round(metrics.fleetP95LatencyMs)}ms)`,
    `- Eval status: ${metrics.evalStatus}`,
    `- Eval cases: ${metrics.evalPassedCases}/${metrics.evalCaseCount || 0} passed`,
    `- Reviewed runs: ${metrics.traceCount}`,
    `- Fleet reliability: ${reliabilitySummary(metrics)}`,
    `- Trace scope: ${traceScopeSummary(metrics)}`,
    `- Tool calls: ${metrics.toolCallCount}`,
    `- Created issues: ${metrics.createdIssues.length}`,
    `- Slack notifications: ${metrics.slackMessages.length}`,
    `- Approval queue: ${metrics.approvalQueue.length}`,
    `- Policy-as-code items: ${metrics.policyDefinitions.length}`,
    `- Policy checks: ${metrics.policyEvaluations}`,
    `- Policy violations: ${policyViolationSummary(metrics)}`,
    `- Average latency: ${Math.round(metrics.avgLatencyMs)}ms`,
    `- P95 latency: ${Math.round(metrics.p95LatencyMs)}ms`,
    `- Fleet P95 latency: ${Math.round(metrics.fleetP95LatencyMs)}ms (${metrics.latencyStatus})`,
    `- Total cost: $${metrics.totalCostUsd.toFixed(4)}`,
    '',
    '## Field Deployment Method',
    '',
    `- Workflow: ${metrics.fieldMethod.workflowName}`,
    `- Owner: ${metrics.fieldMethod.owner}`,
    `- Current state: ${metrics.fieldMethod.currentState}`,
    `- Target state: ${metrics.fieldMethod.targetState}`,
    `- Baseline: ${metrics.fieldMethod.baseline}`,
    `- Target: ${metrics.fieldMethod.target}`,
    `- Rollout stage: ${metrics.fieldMethod.rolloutStage}`,
    `- Next step: ${metrics.fieldMethod.rolloutNext}`,
    '',
    '### Workflow Scorecard',
    '',
    ...markdownTable(
      ['Signal', 'Rating', 'Status', 'Detail'],
      metrics.fieldMethod.scorecard.map((item) => [
        item.label,
        item.value,
        item.status,
        item.detail,
      ]),
    ),
    '',
    '### Outcome Metrics',
    '',
    ...markdownTable(
      ['Metric', 'Target', 'Status', 'Baseline'],
      metrics.fieldMethod.outcomeMetrics.map((item) => [
        item.label,
        item.value,
        item.status,
        item.detail,
      ]),
    ),
    '',
    '### Data Layers',
    '',
    ...markdownTable(
      ['Layer', 'Values', 'Status', 'Detail'],
      metrics.fieldMethod.dataLayers.map((item) => [
        item.label,
        item.value,
        item.status,
        item.detail,
      ]),
    ),
    '',
    '### Rollout Plan',
    '',
    ...markdownTable(
      ['Stage', 'Current', 'Detail'],
      (metrics.fieldMethod.rolloutStages.length > 0 ? metrics.fieldMethod.rolloutStages : [metrics.fieldMethod.rolloutStage])
        .map((stage) => [
          stage,
          stage === metrics.fieldMethod.rolloutStage ? 'yes' : '',
          stage === metrics.fieldMethod.rolloutStage ? metrics.fieldMethod.rolloutNext : 'planned',
        ]),
    ),
    '',
    '### Deployment Harness',
    '',
    `- Name: ${metrics.harness.name}`,
    `- Description: ${metrics.harness.description}`,
    `- Max steps: ${metrics.harness.maxSteps}`,
    `- Review: ${metrics.harness.review}`,
    `- Steering: ${metrics.harness.steer}`,
    `- Artifact refs: ${metrics.harness.artifactRefs.join(', ') || 'not configured'}`,
    '',
    ...markdownTable(
      ['Phase', 'Controls', 'Status', 'Detail'],
      metrics.harness.phases.map((item) => [
        item.label,
        item.value,
        item.status,
        item.detail,
      ]),
    ),
    '',
    ...markdownTable(
      ['Reference', 'Kind', 'Status', 'Detail'],
      metrics.harness.references.map((item) => [
        item.label,
        item.value,
        item.status,
        item.detail,
      ]),
    ),
    '',
    '## Deployment Health Signals',
    '',
    ...markdownTable(
      ['Signal', 'Status', 'Detail'],
      metrics.readinessSignals.map((signal) => [
        signal.label,
        signal.status,
        signal.detail,
      ]),
    ),
    '',
    '## Business Impact',
    '',
    ...markdownTable(
      ['Signal', 'Value', 'Status', 'Detail'],
      metrics.businessImpact.map((item) => [
        item.label,
        item.value,
        item.status,
        item.detail,
      ]),
    ),
    '',
    '## Workflow Map',
    '',
    ...markdownTable(
      ['Step', 'Status', 'Detail'],
      metrics.workflowMap.map((step) => [
        step.label,
        step.status,
        step.detail,
      ]),
    ),
    '',
    '## Integration Readiness',
    '',
    ...markdownTable(
      ['System', 'Status', 'Detail'],
      metrics.integrationReadiness.map((item) => [
        item.label,
        item.status,
        item.detail,
      ]),
    ),
    '',
    '## Production Readiness',
    '',
    ...markdownTable(
      ['Control', 'Status', 'Detail'],
      metrics.productionReadiness.map((item) => [
        item.label,
        item.status,
        item.detail,
      ]),
    ),
    '',
    '## Governance Posture',
    '',
    ...markdownTable(
      ['Control', 'Status', 'Detail'],
      metrics.governancePosture.map((item) => [
        item.label,
        item.status,
        item.detail,
      ]),
    ),
    '',
    '## Enforcement Posture',
    '',
    ...markdownTable(
      ['Control', 'Status', 'Detail'],
      metrics.enforcementPosture.map((item) => [
        item.label,
        item.status,
        item.detail,
      ]),
    ),
    '',
    '## Pattern Reuse',
    '',
    ...markdownTable(
      ['Signal', 'Value', 'Status', 'Detail'],
      metrics.reusablePatterns.map((item) => [
        item.label,
        item.value,
        item.status,
        item.detail,
      ]),
    ),
    '',
    '## Latest Handoff',
    '',
    `- Final answer: ${metrics.finalAnswer ?? 'No final answer captured yet'}`,
    `- External actions: ${metrics.createdIssues.length} issue(s), ${metrics.slackMessages.length} Slack notification(s)`,
    '',
    '## Connector Evidence',
    '',
    ...markdownTable(
      ['Connector', 'Tool', 'Evidence', 'Detail'],
      connectorEvidence.map((evidence) => [
        evidence.connector,
        evidence.toolName,
        evidence.title,
        evidence.detail,
      ]),
    ),
    '',
    '## Approval Queue',
    '',
    ...markdownTable(
      ['ID', 'Policy', 'Tool', 'Status', 'Reason'],
      metrics.approvalQueue.map((approval) => [
        approval.approvalId ?? '',
        approval.policy,
        approval.toolName,
        approval.status,
        approval.reason,
      ]),
    ),
    '',
    '## Policy-as-Code',
    '',
    ...markdownTable(
      ['Scope', 'Policy', 'Kind', 'Detail'],
      metrics.policyDefinitions.map((policy) => [
        policy.scope,
        policy.name,
        policy.kind,
        policy.detail,
      ]),
    ),
    '',
    '## Budget Caps',
    '',
    ...markdownTable(
      ['Scope', 'Policy', 'Used', 'Cap'],
      metrics.budgetCaps.map((budget) => [
        budget.scope,
        budget.policy,
        `$${metrics.totalCostUsd.toFixed(4)}`,
        `$${budget.maxUsd.toFixed(4)}`,
      ]),
    ),
    '',
    '## Audit Log',
    '',
    ...markdownTable(
      ['Time', 'Outcome', 'Action', 'Actor', 'Detail'],
      metrics.auditLog.slice(-12).map((entry) => [
        entry.createdAt,
        entry.outcome,
        entry.action,
        entry.actor,
        [entry.toolName, entry.policy, entry.approvalId, entry.message].filter(Boolean).join(' - '),
      ]),
    ),
    '',
    '## Created Issues',
    '',
    ...markdownTable(
      ['Tracker', 'Mode', 'ID', 'Title', 'Destination', 'URL'],
      metrics.createdIssues.map((issue) => [
        issue.tracker,
        issueModeSummary(issue.mode),
        issue.id,
        issue.title,
        issue.destination ?? '',
        issue.url ?? '',
      ]),
    ),
    '',
    '## Slack Notifications',
    '',
    ...markdownTable(
      ['Channel', 'Text', 'Ticket', 'Mode'],
      metrics.slackMessages.map((message) => [
        message.channel,
        message.text,
        message.ticketId ?? '',
        message.mode ?? '',
      ]),
    ),
    '',
    '## Run History',
    '',
    ...markdownTable(
      ['Run', 'Status', 'Latency', 'Tools', 'Issues', 'Slack'],
      metrics.runHistory.map((run) => [
        run.traceId,
        run.status,
        `${Math.round(run.latencyMs)}ms`,
        String(run.toolCalls.length),
        String(run.issueCount),
        String(run.slackCount),
      ]),
    ),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function traceScopeSummary(metrics: ConsoleMetrics): string {
  if (metrics.traceScope === 'latest_eval') {
    return `latest eval (${metrics.allTraceCount} stored trace artifacts)`;
  }

  if (metrics.traceScope === 'latest_run') {
    return `latest run (${metrics.allTraceCount} stored trace artifacts)`;
  }

  return 'all stored traces';
}

function reliabilitySummary(metrics: ConsoleMetrics): string {
  if (metrics.totalRunCount === 0) {
    return 'no stored run history captured';
  }

  const protectedCount = metrics.completedRunCount + metrics.policyBlockedRunCount;

  const successPercent = Math.round(metrics.successRate * 100);

  return `${protectedCount}/${metrics.totalRunCount} completed or guardrail-stopped (${successPercent}%); `
    + `${metrics.policyBlockedRunCount} governance stop(s), ${metrics.reliabilityFailureCount} reliability failure(s)`;
}

function policyViolationSummary(metrics: ConsoleMetrics): string {
  const qualifier = metrics.enforcementMode === 'advisory'
    ? ' (advisory mode - not enforced)'
    : '';

  return `${metrics.policyViolationCount}${qualifier}`;
}

function issueModeSummary(mode: string | undefined): string {
  if (mode === 'local') {
    return 'SIMULATED (mode: local)';
  }

  return mode ? `mode: ${mode}` : 'not captured';
}

function markdownTable(headers: string[], rows: string[][]): string[] {
  if (rows.length === 0) {
    return ['No rows captured'];
  }

  return [
    `| ${headers.map(markdownCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(markdownCell).join(' | ')} |`),
  ];
}
