import {
  asRecord,
  getNumber,
  getString,
  type DeploymentDefinition,
  type GovernanceDefinition,
  type HarnessDefinition,
} from '@fdekit/core';
import { collectEvals, type EvalArtifact } from './evals/index.js';
import type { TraceArtifact, TraceEvent } from './traces/index.js';
import { joinNames } from './utils.js';

export function renderReport(
  deployment: DeploymentDefinition,
  latestEval: EvalArtifact | null,
  traces: TraceArtifact[],
): string {
  const providerNames = Object.keys(deployment.providers ?? {});
  const connectorNames = Object.keys(deployment.connectors ?? {});
  const agentNames = Object.keys(deployment.agents ?? {});
  const sortedTraces = sortTracesByCreatedAt(traces);
  const latestTrace = sortedTraces.at(-1) ?? null;
  const runSummary = latestTrace ? collectRunSummary(latestTrace) : null;
  const toolCalls = latestTrace ? collectCompletedToolNames(latestTrace) : [];
  const codeEvidence = latestTrace ? collectCodeEvidence(latestTrace) : [];
  const createdIssues = latestTrace ? collectCreatedIssues(latestTrace) : [];
  const policySummary = latestTrace ? collectPolicySummary(latestTrace) : { checks: 0, violations: 0 };

  return `# ${deployment.name} Deployment Report

Created: ${new Date().toISOString()}

## Summary

- Environment: ${deployment.environment ?? 'local'}
- Providers: ${joinNames(providerNames)}
- Connectors: ${joinNames(connectorNames)}
- Agents: ${joinNames(agentNames)}

## Run Reviewed

- Trace: ${latestTrace?.id ?? 'none'}
- Status: ${runSummary?.status ?? 'not run'}
- Agent: ${runSummary?.agent ?? joinNames(agentNames)}
- Final answer: ${runSummary?.finalAnswer ?? 'No final answer captured yet'}

## Evidence

- Tool calls: ${joinNames(toolCalls)}
- Code evidence: ${formatCodeEvidence(codeEvidence)}
- Created issues: ${formatCreatedIssues(createdIssues)}

## Governance

- Deployment policies: ${joinNames(collectReportPolicyNames(deployment))}
- Policy checks: ${policySummary.checks}
- Policy violations: ${policySummary.violations}
- Evals configured: ${collectEvals(deployment).length}

## Latest Eval

- Status: ${latestEval?.status ?? 'not run'}
- Suites: ${latestEval?.results?.length ?? 0}

## Observability

- Traces captured: ${traces.length}
- Latest trace: ${latestTrace?.id ?? 'none'}
`;
}

interface ReportRunSummary {
  agent?: string;
  status: string;
  finalAnswer?: string;
}

interface ReportCodeEvidence {
  filePath: string;
  line?: number;
  preview?: string;
  startLine?: number;
  endLine?: number;
}

interface ReportCreatedIssue {
  id: string;
  title: string;
  destination?: string;
  mode?: string;
  url?: string;
}

function sortTracesByCreatedAt(traces: TraceArtifact[]): TraceArtifact[] {
  return [...traces].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function collectRunSummary(trace: TraceArtifact): ReportRunSummary {
  const started = trace.events.find((event) => event.type === 'agent.run.started');
  const completed = findLastEvent(trace.events, 'agent.run.completed');
  const completedRecord = asRecord(completed);

  return {
    agent: getString(started?.agent) ?? getString(completedRecord.agent),
    status: getString(completedRecord.status) ?? 'unknown',
    finalAnswer: firstParagraph(getString(completedRecord.message)),
  };
}

function collectCompletedToolNames(trace: TraceArtifact): string[] {
  const names: string[] = [];

  for (const event of trace.events) {
    if (event.type !== 'tool.call.completed') {
      continue;
    }

    const toolName = getString(event.toolName);
    if (toolName) {
      names.push(toolName);
    }
  }

  return names;
}

function collectCodeEvidence(trace: TraceArtifact): ReportCodeEvidence[] {
  const evidence: ReportCodeEvidence[] = [];

  for (const event of trace.events) {
    if (event.type !== 'tool.call.completed') {
      continue;
    }

    const toolName = getString(event.toolName);
    const result = asRecord(event.result);

    if (toolName === 'codebase.search' && Array.isArray(result.matches)) {
      for (const match of result.matches) {
        const matchRecord = asRecord(match);
        const filePath = getString(matchRecord.filePath);
        if (!filePath) {
          continue;
        }

        evidence.push({
          filePath,
          line: getNumber(matchRecord.line),
          preview: getString(matchRecord.preview),
        });
      }
    }

    if (toolName === 'codebase.readFile') {
      const filePath = getString(result.filePath);
      if (!filePath) {
        continue;
      }

      evidence.push({
        filePath,
        startLine: getNumber(result.startLine),
        endLine: getNumber(result.endLine),
      });
    }
  }

  return dedupeCodeEvidence(evidence);
}

function collectCreatedIssues(trace: TraceArtifact): ReportCreatedIssue[] {
  return trace.events
    .filter((event) => event.type === 'tool.call.completed' && isIssueTool(event.toolName))
    .map((event) => {
      const result = asRecord(event.result);
      const args = asRecord(event.args);
      const number = getNumber(result.number);
      const id = getString(result.key)
        ?? getString(result.identifier)
        ?? (typeof number === 'number' ? `#${number}` : undefined)
        ?? getString(result.id)
        ?? 'unknown';

      return {
        id,
        title: getString(result.title) ?? getString(result.summary) ?? getString(args.title) ?? getString(args.summary) ?? 'Untitled issue',
        destination: getString(result.repository) ?? getString(result.destination) ?? getString(result.projectKey) ?? getString(result.teamId),
        mode: getString(result.mode),
        url: getString(result.url),
      };
    });
}

function collectPolicySummary(trace: TraceArtifact): { checks: number; violations: number } {
  const policyEvents = trace.events.filter((event) => event.type === 'policy.evaluated');

  return {
    checks: policyEvents.length,
    violations: policyEvents.filter((event) => event.allowed === false).length,
  };
}

function formatCodeEvidence(evidence: ReportCodeEvidence[]): string {
  if (evidence.length === 0) {
    return 'none captured';
  }

  return evidence.map((item) => {
    const location = typeof item.line === 'number'
      ? `${item.filePath}:${item.line}`
      : typeof item.startLine === 'number' && typeof item.endLine === 'number'
        ? `${item.filePath}:${item.startLine}-${item.endLine}`
        : item.filePath;
    const preview = item.preview ? ` (${item.preview})` : '';

    return `${location}${preview}`;
  }).join('; ');
}

function formatCreatedIssues(issues: ReportCreatedIssue[]): string {
  if (issues.length === 0) {
    return 'none captured';
  }

  return issues.map((issue) => {
    const destination = issue.destination ? ` in ${issue.destination}` : '';
    const mode = issue.mode ? ` via ${issue.mode}` : '';
    const link = issue.url ? ` (${issue.url})` : '';

    return `${issue.title} [${issue.id}]${destination}${mode}${link}`;
  }).join('; ');
}

function dedupeCodeEvidence(evidence: ReportCodeEvidence[]): ReportCodeEvidence[] {
  const seen = new Set<string>();
  const deduped: ReportCodeEvidence[] = [];

  for (const item of evidence) {
    const key = `${item.filePath}:${item.line ?? item.startLine ?? ''}:${item.endLine ?? ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function firstParagraph(value: string | undefined): string | undefined {
  return value?.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim();
}

function findLastEvent(events: TraceEvent[], type: string): TraceEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.type === type) {
      return events[index];
    }
  }

  return undefined;
}

function isIssueTool(toolName: unknown): boolean {
  return typeof toolName === 'string' && (toolName === 'issue.create' || toolName.endsWith('.issue.create'));
}

export function collectReportPolicyNames(deployment: DeploymentDefinition): string[] {
  const policyNames: string[] = [];
  const agentNames = Object.keys(deployment.agents ?? {});
  const addPolicyName = (name: string | undefined) => {
    if (name && !policyNames.includes(name)) {
      policyNames.push(name);
    }
  };

  for (const policy of deployment.policies ?? []) {
    addPolicyName(policy.name);
  }

  collectGovernancePolicyNames(deployment.governance, agentNames, addPolicyName);
  collectHarnessPolicyRefs(deployment.harness, addPolicyName);

  for (const [agentName, agent] of Object.entries(deployment.agents ?? {})) {
    for (const policy of agent.policies ?? []) {
      addPolicyName(policy.name);
    }

    collectGovernancePolicyNames(agent.governance, [agentName], addPolicyName);
    collectHarnessPolicyRefs(agent.harness, addPolicyName);
  }

  return policyNames;
}

function collectGovernancePolicyNames(
  governance: GovernanceDefinition | undefined,
  agentNames: string[],
  addPolicyName: (name: string | undefined) => void,
): void {
  if (!governance) {
    return;
  }

  if (governance.dataProtection?.denyPII) {
    addPolicyName('deny-pii-leak');
  }

  if (governance.dataProtection?.redactSecrets) {
    addPolicyName('redact-secrets');
  }

  const environments = governance.environments;
  if (environments?.allowed?.length || environments?.denied?.length || environments?.tools?.length) {
    addPolicyName('restrict-environments');
  }

  collectPermissionPolicyNames(governance, agentNames, addPolicyName);

  for (const budget of governance.budgets ?? []) {
    if (budgetAppliesToAnyAgent(budget.scope, agentNames)) {
      addPolicyName(budget.name ?? 'limit-cost');
    }
  }
}

function collectPermissionPolicyNames(
  governance: GovernanceDefinition,
  agentNames: string[],
  addPolicyName: (name: string | undefined) => void,
): void {
  const permissions = governance.permissions;

  if (!permissions) {
    return;
  }

  const grants = (permissions.grants ?? [])
    .filter((grant) => !grant.agent || agentNames.includes(grant.agent));

  if (grants.length > 0) {
    for (const grant of grants) {
      addPolicyName(grant.name ?? 'limit-tool-scopes');
    }
    return;
  }

  const allowed = permissions.allowedScopes?.length
    ? permissions.allowedScopes
    : permissions.scopes?.map((scope) => scope.name) ?? [];

  if (allowed.length > 0 || permissions.deniedScopes?.length || permissions.requireScopes) {
    addPolicyName('limit-tool-scopes');
  }
}

function collectHarnessPolicyRefs(
  harness: HarnessDefinition | undefined,
  addPolicyName: (name: string | undefined) => void,
): void {
  for (const policyRef of harness?.policyRefs ?? []) {
    addPolicyName(policyRef);
  }

  for (const phase of harness?.phases ?? []) {
    for (const policyRef of phase.policyRefs ?? []) {
      addPolicyName(policyRef);
    }
  }
}

function budgetAppliesToAnyAgent(scope: string | undefined, agentNames: string[]): boolean {
  return !scope || scope === 'deployment' || agentNames.some((agentName) => scope === `agent:${agentName}`);
}
