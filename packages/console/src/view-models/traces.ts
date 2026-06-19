import {
  asRecord,
  getNumber,
  getString,
  isDefined,
} from '@fdekit/core';
import type { TraceArtifact, TraceEvent } from '@fdekit/runtime';
import type {
  ConnectorEvidence,
  CreatedIssue,
  RunHistoryItem,
  SlackNotification,
} from '../interfaces/index.js';
import {
  isIssueTool,
  issueFromEvent,
  lastEventOfType,
  slackFromEvent,
} from './trace-events.js';

export function latestTrace(traces: TraceArtifact[]): TraceArtifact | null {
  return [...traces].sort((left, right) => left.createdAt.localeCompare(right.createdAt)).at(-1) ?? null;
}

export function collectCreatedIssues(traces: TraceArtifact[]): CreatedIssue[] {
  return traces.flatMap((trace) => (trace.events ?? [])
    .filter((event) => event.type === 'tool.call.completed' && isIssueTool(event.toolName))
    .map((event) => issueFromEvent(trace.id, trace.createdAt, event)))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function collectSlackMessages(traces: TraceArtifact[]): SlackNotification[] {
  return traces.flatMap((trace) => (trace.events ?? [])
    .filter((event) => event.type === 'tool.call.completed' && event.toolName === 'slack.message')
    .map((event) => slackFromEvent(trace.id, trace.createdAt, event)))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function collectRunHistory(traces: TraceArtifact[]): RunHistoryItem[] {
  return [...traces]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((trace) => {
      const completed = lastEventOfType(trace.events ?? [], 'agent.run.completed');
      const completedRecord = asRecord(completed);
      const toolCalls = (trace.events ?? [])
        .filter((event) => event.type === 'tool.call.completed')
        .map((event) => getString(event.toolName) ?? 'unknown');

      return {
        traceId: trace.id,
        createdAt: trace.createdAt,
        status: getString(completedRecord.status) ?? 'unknown',
        latencyMs: getNumber(completedRecord.latencyMs) ?? 0,
        costUsd: getNumber(completedRecord.costUsd) ?? 0,
        toolCalls,
        issueCount: toolCalls.filter((toolName) => isIssueTool(toolName)).length,
        slackCount: toolCalls.filter((toolName) => toolName === 'slack.message').length,
        finalAnswer: getString(completedRecord.message),
      };
    });
}

export function collectConnectorEvidence(traces: TraceArtifact[]): ConnectorEvidence[] {
  return traces.flatMap((trace) => (trace.events ?? [])
    .filter((event) => event.type === 'tool.call.completed')
    .map((event) => connectorEvidenceFromEvent(trace, event))
    .filter(isDefined))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function collectGenericConnectorEvidence(evidence: ConnectorEvidence[]): ConnectorEvidence[] {
  return evidence.filter((item) => !isDedicatedCustomerEvidenceTool(item.toolName));
}

export function isProvenConnectorEvidence(evidence: ConnectorEvidence): boolean {
  return evidence.evidenceKind !== 'simulated' && evidence.status !== 'failed';
}

function isDedicatedCustomerEvidenceTool(toolName: string): boolean {
  return isIssueTool(toolName) || toolName === 'slack.message';
}

function connectorEvidenceFromEvent(trace: TraceArtifact, event: TraceEvent): ConnectorEvidence | undefined {
  const toolName = getString(event.toolName);

  if (!toolName) {
    return undefined;
  }

  if (isIssueTool(toolName)) {
    const issue = issueFromEvent(trace.id, trace.createdAt, event);
    return {
      connector: issue.tracker,
      toolName,
      title: `Created issue ${issue.id}`,
      detail: issue.title,
      mode: issue.mode,
      url: issue.url,
      traceId: trace.id,
      createdAt: trace.createdAt,
    };
  }

  if (toolName === 'slack.message') {
    const message = slackFromEvent(trace.id, trace.createdAt, event);
    return {
      connector: 'slack',
      toolName,
      title: `Sent message to ${message.channel}`,
      detail: message.text,
      mode: message.mode,
      traceId: trace.id,
      createdAt: trace.createdAt,
    };
  }

  if (toolName === 'loadtest.run') {
    const result = asRecord(event.result);
    const metrics = asRecord(result.metrics);
    const thresholds = asRecord(result.thresholds);
    const mode = getString(result.mode);
    const reportedEvidenceKind = getString(result.evidenceKind);
    const evidenceKind = reportedEvidenceKind === 'simulated' || mode === 'local'
      ? 'simulated'
      : 'measured';
    const targetUrl = getString(result.targetUrl) ?? 'configured target';
    const status = getString(result.status) ?? 'unknown';
    const p95 = getNumber(metrics.httpReqDurationP95Ms) ?? 0;
    const errorRate = (getNumber(metrics.httpReqFailedRate) ?? 0) * 100;
    const thresholdPassed = thresholds.passed === true;

    return {
      connector: 'k6',
      toolName,
      title: evidenceKind === 'simulated'
        ? `Simulated local load-test scenario for ${targetUrl}`
        : `Measured k6 load test for ${targetUrl}`,
      detail: evidenceKind === 'simulated'
        ? `No HTTP request or k6 execution; deterministic outcome ${status}, p95 ${p95}ms, error rate ${errorRate.toFixed(2)}%, threshold passed: ${thresholdPassed}`
        : `Measured outcome ${status}, p95 ${p95}ms, error rate ${errorRate.toFixed(2)}%, threshold passed: ${thresholdPassed}`,
      evidenceKind,
      status: status === 'failed' ? 'failed' : 'passed',
      mode,
      traceId: trace.id,
      createdAt: trace.createdAt,
    };
  }

  if (toolName.startsWith('postgres.')) {
    const result = asRecord(event.result);
    const tables = Array.isArray(result.tables) ? result.tables.map(String).join(', ') : '';
    const rowCount = getNumber(result.rowCount);
    return {
      connector: 'postgres',
      toolName,
      title: postgresEvidenceTitle(toolName),
      detail: [tables ? `tables: ${tables}` : '', rowCount !== undefined ? `${rowCount} row(s)` : 'query completed'].filter(Boolean).join(' - '),
      traceId: trace.id,
      createdAt: trace.createdAt,
    };
  }

  if (toolName.startsWith('codebase.')) {
    const result = asRecord(event.result);
    const matches = Array.isArray(result.matches) ? result.matches.length : undefined;
    const files = Array.isArray(result.files) ? result.files.length : undefined;
    const filePath = getString(result.filePath);
    return {
      connector: 'codebase',
      toolName,
      title: codebaseEvidenceTitle(toolName),
      detail: filePath ?? (matches !== undefined ? `${matches} match(es)` : files !== undefined ? `${files} file(s)` : 'source evidence captured'),
      traceId: trace.id,
      createdAt: trace.createdAt,
    };
  }

  if (toolName === 'customer.get' || toolName === 'ticket.get' || toolName === 'ticket.escalate') {
    const result = asRecord(event.result);
    const args = asRecord(event.args);
    const title = toolName === 'customer.get'
      ? `Loaded customer ${getString(result.name) ?? getString(result.id) ?? getString(args.customerId) ?? ''}`.trim()
      : toolName === 'ticket.get'
        ? `Loaded ticket ${getString(result.id) ?? getString(args.ticketId) ?? ''}`.trim()
        : `Escalated ticket ${getString(result.id) ?? getString(args.ticketId) ?? ''}`.trim();
    return {
      connector: 'customer-api',
      toolName,
      title,
      detail: getString(result.title) ?? getString(result.status) ?? getString(args.reason) ?? 'customer system call completed',
      traceId: trace.id,
      createdAt: trace.createdAt,
    };
  }

  if (toolName.startsWith('sales.') || toolName.startsWith('crm.')) {
    const result = asRecord(event.result);
    const args = asRecord(event.args);
    return {
      connector: toolName.startsWith('crm.') ? 'crm' : 'sales',
      toolName,
      title: salesEvidenceTitle(toolName),
      detail: getString(result.accountName)
        ?? getString(result.companyName)
        ?? getString(result.contactName)
        ?? getString(result.noteId)
        ?? getString(args.accountId)
        ?? 'sales workflow evidence captured',
      traceId: trace.id,
      createdAt: trace.createdAt,
    };
  }

  if (toolName.startsWith('hubspot.') || toolName.startsWith('salesforce.')) {
    const result = asRecord(event.result);
    return {
      connector: toolName.split('.')[0] ?? 'crm',
      toolName,
      title: crmEvidenceTitle(toolName),
      detail: getString(result.id)
        ?? getString(result.name)
        ?? getString(result.url)
        ?? 'CRM system call completed',
      url: getString(result.url),
      traceId: trace.id,
      createdAt: trace.createdAt,
    };
  }

  return undefined;
}

function postgresEvidenceTitle(toolName: string): string {
  if (toolName === 'postgres.healthCheck') {
    return 'Verified database connection';
  }

  if (toolName === 'postgres.listTables') {
    return 'Discovered database schema';
  }

  if (toolName === 'postgres.describeTable') {
    return 'Inspected governed table';
  }

  return 'Ran governed SQL query';
}

function codebaseEvidenceTitle(toolName: string): string {
  if (toolName === 'codebase.search') {
    return 'Searched customer codebase';
  }

  if (toolName === 'codebase.readFile') {
    return 'Read source evidence';
  }

  return 'Listed customer codebase files';
}

function salesEvidenceTitle(toolName: string): string {
  if (toolName === 'sales.account.lookup') {
    return 'Loaded account research';
  }

  if (toolName === 'sales.contacts.find') {
    return 'Found buying committee contacts';
  }

  if (toolName === 'sales.intent.lookup') {
    return 'Loaded buying intent signals';
  }

  if (toolName === 'crm.note.create') {
    return 'Created CRM handoff note';
  }

  return `Captured ${toolName}`;
}

function crmEvidenceTitle(toolName: string): string {
  if (toolName.includes('contact')) {
    return 'Synced CRM contact';
  }

  if (toolName.includes('company') || toolName.includes('account')) {
    return 'Synced CRM account';
  }

  if (toolName.includes('note')) {
    return 'Created CRM note';
  }

  return `Called ${toolName}`;
}
