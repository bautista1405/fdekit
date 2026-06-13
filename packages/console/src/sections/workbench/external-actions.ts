import type {
  ApprovalQueueItem,
  CreatedIssue,
  SlackNotification,
} from '../../interfaces/index.js';
import {
  escapeHtml,
  formatDate,
  linkLabel,
  shortId,
  statusPill,
} from '../../view-models/index.js';

export function renderCreatedIssues(issues: CreatedIssue[], limit = 8): string {
  if (issues.length === 0) {
    return '<p class="subtle">No issue creation tool calls captured yet.</p>';
  }

  return `<table>
    <thead>
      <tr>
        <th>Tracker</th>
        <th>Issue</th>
        <th>Destination</th>
        <th>Link</th>
      </tr>
    </thead>
    <tbody>
      ${issues.slice(-limit).reverse().map((issue) => `<tr>
        <td>${escapeHtml(issue.tracker)}${issue.mode ? `<div class="event-meta">${escapeHtml(issue.mode)}</div>` : ''}</td>
        <td>
          ${escapeHtml(issue.title)}
          <div class="event-meta">${escapeHtml(issue.id)} - ${escapeHtml(issue.toolName)}</div>
        </td>
        <td>${escapeHtml(issue.destination ?? 'not set')}</td>
        <td>${issue.url ? `<a href="${escapeHtml(issue.url)}">${escapeHtml(linkLabel(issue.url))}</a>` : '<span class="subtle">none</span>'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

export function renderSlackMessages(messages: SlackNotification[], limit = 6): string {
  if (messages.length === 0) {
    return '<p class="subtle">No Slack messages captured yet.</p>';
  }

  return `<div>
    ${messages.slice(-limit).reverse().map((message) => `<div class="message-row">
      <div class="row-label">${escapeHtml(message.channel)}</div>
      <div class="row-main">
        ${escapeHtml(message.text)}
        <div class="event-meta">${escapeHtml([message.mode, message.ticketId, message.ts].filter(Boolean).join(' - '))}</div>
      </div>
    </div>`).join('')}
  </div>`;
}

export function renderApprovalQueue(queue: ApprovalQueueItem[]): string {
  if (queue.length === 0) {
    return `<ul class="summary-list">
      <li><span>Pending approvals</span><strong>0</strong></li>
      <li><span>Blocked actions</span><strong>0</strong></li>
      <li><span>Status</span><strong>clear</strong></li>
    </ul>`;
  }

  return `<table>
    <thead><tr><th>Request</th><th>Tool</th><th>Status</th><th>Reason</th></tr></thead>
    <tbody>
      ${queue.map((item) => `<tr>
        <td>
          ${escapeHtml(item.approvalId ?? item.policy)}
          <div class="event-meta">${escapeHtml(item.policy)}</div>
        </td>
        <td class="mono">${escapeHtml(item.toolName)}</td>
        <td>${statusPill(item.status)}</td>
        <td>
          ${escapeHtml(item.reason)}
          <div class="event-meta">${escapeHtml([
            shortId(item.traceId),
            formatDate(item.createdAt),
            item.decidedBy ? `by ${item.decidedBy}` : '',
          ].filter(Boolean).join(' - '))}</div>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}
