import { asRecord, getString } from '@fdekit/core';
import type {
  TraceArtifact,
  TraceEvent,
} from '@fdekit/runtime';
import {
  escapeHtml,
  eventMessage,
  eventMeta,
  isIssueTool,
} from '../../view-models/index.js';

export function renderRunStory(trace: TraceArtifact | null): string {
  if (!trace || trace.events.length === 0) {
    return '<p class="subtle">Run the agent to generate a story from trace events.</p>';
  }

  const storyEvents = trace.events
    .filter((event) => event.type === 'tool.call.completed' || event.type === 'agent.run.completed')
    .slice(-8);

  if (storyEvents.length === 0) {
    return '<p class="subtle">No completed agent steps captured yet.</p>';
  }

  return `<div>
    ${storyEvents.map((event) => {
      const story = storyForEvent(event);
      return `<div class="story-row">
        <div><span class="step-mark ${escapeHtml(story.kind)}">${escapeHtml(story.mark)}</span></div>
        <div class="row-main">
          <strong>${escapeHtml(story.title)}</strong>
          <div class="event-meta">${escapeHtml(story.detail)}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

export function renderTimeline(trace: TraceArtifact | null): string {
  if (!trace || trace.events.length === 0) {
    return '<p class="subtle">No trace events captured yet.</p>';
  }

  const events = trace.events.slice(-16);

  return `<div class="timeline">
    ${events.map((event) => `<article class="event">
      <div class="event-type">${escapeHtml(event.type)}</div>
      <div class="event-main">
        ${escapeHtml(eventMessage(event))}
        <div class="event-meta">${escapeHtml(eventMeta(event))}</div>
      </div>
    </article>`).join('')}
  </div>`;
}

function storyForEvent(event: TraceEvent): { mark: string; kind: string; title: string; detail: string } {
  const toolName = getString(event.toolName);

  if (toolName) {
    if (isIssueTool(toolName)) {
      const result = asRecord(event.result);
      return {
        mark: 'I',
        kind: 'issue',
        title: 'Created issue',
        detail: getString(result.title) ?? getString(result.key) ?? getString(result.identifier) ?? toolName,
      };
    }

    if (toolName === 'slack.message') {
      const result = asRecord(event.result);
      return {
        mark: 'S',
        kind: 'slack',
        title: 'Sent Slack notification',
        detail: `${getString(result.channel) ?? 'channel'} - ${getString(result.text) ?? 'message captured'}`,
      };
    }

    return {
      mark: 'T',
      kind: 'tool',
      title: toolActionTitle(toolName),
      detail: eventMessage(event),
    };
  }

  return {
    mark: 'F',
    kind: 'final',
    title: 'Completed run',
    detail: getString(event.message) ?? 'Agent run completed',
  };
}

function toolActionTitle(toolName: string): string {
  if (toolName === 'codebase.search') {
    return 'Searched codebase';
  }

  if (toolName === 'codebase.readFile') {
    return 'Read source evidence';
  }

  if (toolName === 'ticket.get') {
    return 'Loaded support ticket';
  }

  if (toolName === 'customer.get') {
    return 'Loaded customer context';
  }

  if (toolName === 'ticket.escalate') {
    return 'Escalated ticket';
  }

  return `Called ${toolName}`;
}
