import {
  getString,
  isDefined,
} from '@fdekit/core';
import type { TraceArtifact } from '@fdekit/runtime';
import type { WorkflowStepItem } from '../../interfaces/index.js';
import { formatDate, shortId } from '../format.js';
import {
  isActionTool,
  isContextTool,
  summarizeList,
} from '../helpers.js';
import { lastEventOfType } from '../trace-events.js';

export function createWorkflowMap(input: {
  latestTrace: TraceArtifact | null;
  evalStatus: string;
  policyEventCount: number;
  approvalQueueCount: number;
  finalAnswer: string | null;
}): WorkflowStepItem[] {
  const events = input.latestTrace?.events ?? [];
  const toolNames = events
    .filter((event) => event.type === 'tool.call.completed' || event.type === 'provider.step.tool_call')
    .map((event) => getString(event.toolName))
    .filter(isDefined);
  const contextTools = toolNames.filter(isContextTool);
  const actionTools = toolNames.filter(isActionTool);
  const finalEvent = lastEventOfType(events, 'agent.run.completed');

  return [
    {
      label: 'Trigger',
      status: input.latestTrace ? 'pass' : 'warn',
      detail: input.latestTrace
        ? `Latest run ${shortId(input.latestTrace.id)} started ${formatDate(input.latestTrace.createdAt)}`
        : 'No run trace captured yet',
    },
    {
      label: 'Customer context',
      status: contextTools.length > 0 ? 'pass' : 'warn',
      detail: contextTools.length > 0
        ? `Read via ${summarizeList([...new Set(contextTools)], 3)}`
        : 'No customer data or source lookup captured yet',
    },
    {
      label: 'Governed decision',
      status: input.policyEventCount > 0 ? input.approvalQueueCount > 0 ? 'warn' : 'pass' : 'warn',
      detail: input.policyEventCount > 0
        ? `${input.policyEventCount} policy check(s), ${input.approvalQueueCount} open approval item(s)`
        : 'No policy checks captured yet',
    },
    {
      label: 'System action',
      status: actionTools.length > 0 ? 'pass' : 'warn',
      detail: actionTools.length > 0
        ? `Acted through ${summarizeList([...new Set(actionTools)], 3)}`
        : 'No issue, Slack, CRM, escalation, or database action captured yet',
    },
    {
      label: 'Handoff',
      status: input.finalAnswer && input.evalStatus === 'passed' ? 'pass' : input.finalAnswer ? 'warn' : 'fail',
      detail: input.finalAnswer
        ? `Final answer captured; eval status ${input.evalStatus}`
        : finalEvent ? 'Run completed without a final answer' : 'No completed run handoff captured yet',
    },
  ];
}
