import { asRecord, getNumber, getString } from '@fdekit/core';
import type { TraceEvent } from '@fdekit/runtime';
import type { CreatedIssue, SlackNotification } from '../interfaces/index.js';

export function isIssueTool(toolName: unknown): boolean {
  return typeof toolName === 'string' && (toolName === 'issue.create' || toolName.endsWith('.issue.create'));
}

export function issueFromEvent(traceId: string, createdAt: string, event: TraceEvent): CreatedIssue {
  const result = asRecord(event.result);
  const args = asRecord(event.args);
  const toolName = String(event.toolName ?? 'issue.create');
  const number = getNumber(result.number);
  const key = getString(result.key);
  const identifier = getString(result.identifier);
  const id = key ?? identifier ?? (typeof number === 'number' ? `#${number}` : undefined) ?? getString(result.id) ?? 'unknown';
  const url = getString(result.url);

  return {
    tracker: getString(result.tracker) ?? inferTracker(toolName, url),
    toolName,
    id,
    title: getString(result.title) ?? getString(result.summary) ?? getString(args.title) ?? getString(args.summary) ?? 'Untitled issue',
    mode: getString(result.mode),
    url,
    destination: getString(result.destination)
      ?? getString(result.repository)
      ?? getString(result.projectKey)
      ?? getString(result.teamId),
    traceId,
    createdAt,
  };
}

export function slackFromEvent(traceId: string, createdAt: string, event: TraceEvent): SlackNotification {
  const result = asRecord(event.result);
  const args = asRecord(event.args);

  return {
    channel: getString(result.channel) ?? getString(args.channel) ?? 'unknown channel',
    text: getString(result.text) ?? getString(args.text) ?? 'No message text captured',
    mode: getString(result.mode),
    ticketId: getString(result.ticketId) ?? getString(args.ticketId),
    ts: getString(result.ts),
    traceId,
    createdAt,
  };
}

export function eventMessage(event: TraceEvent): string {
  if (typeof event.message === 'string') {
    return event.message;
  }

  if (typeof event.toolName === 'string') {
    if (event.type === 'tool.call.completed') {
      return `${event.toolName} completed`;
    }

    return event.toolName;
  }

  if (typeof event.policy === 'string') {
    return `${event.policy}: ${String(event.allowed ?? 'unknown')}`;
  }

  return event.type;
}

export function eventMeta(event: TraceEvent): string {
  const parts = [
    typeof event.provider === 'string' ? `provider ${event.provider}` : '',
    typeof event.stepIndex === 'number' ? `step ${event.stepIndex}` : '',
    typeof event.latencyMs === 'number' ? `${event.latencyMs}ms` : '',
    typeof event.reason === 'string' ? event.reason : '',
  ].filter(Boolean);

  return parts.join(' - ');
}

export function lastEventOfType(events: TraceEvent[], type: string): TraceEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.type === type) {
      return events[index];
    }
  }

  return undefined;
}

function inferTracker(toolName: string, url: string | undefined): string {
  if (toolName.startsWith('jira.') || url?.includes('atlassian.net') || url?.includes('jira.')) {
    return 'jira';
  }

  if (toolName.startsWith('linear.') || url?.includes('linear.')) {
    return 'linear';
  }

  if (url?.includes('github.')) {
    return 'github';
  }

  return 'issue tracker';
}
