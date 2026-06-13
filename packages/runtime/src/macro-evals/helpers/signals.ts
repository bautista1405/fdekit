import type { MacroEvalFinding } from '../interfaces/index.js';
import {
  TOOL_SEMANTICS,
  toolCallsWithSemantic,
  type ToolMetadataIndex,
} from '../../tool-metadata.js';

export function inferBehaviorSignals(input: {
  runOutcome: string;
  toolCalls: string[];
  toolMetadata?: ToolMetadataIndex;
  evalFindings: MacroEvalFinding[];
  policyEvents: string[];
  approvalEvents: string[];
}): string[] {
  const signals = new Set<string>();

  for (const finding of input.evalFindings) {
    signals.add(finding.category);
  }

  if (input.runOutcome !== 'completed') {
    signals.add(input.runOutcome === 'waiting_approval' ? 'human review' : 'run failure');
  }

  if (input.policyEvents.length > 0) {
    signals.add('policy or guardrail');
  }

  if (input.approvalEvents.length > 0) {
    signals.add('human review');
  }

  if (toolCallsWithSemantic(input.toolCalls, input.toolMetadata, TOOL_SEMANTICS.escalation).length > 0) {
    signals.add('escalation routing');
  }

  if (toolCallsWithSemantic(input.toolCalls, input.toolMetadata, TOOL_SEMANTICS.crmHandoff).length > 0) {
    signals.add('crm handoff');
  }

  if (hasRepeatedTool(input.toolCalls)) {
    signals.add('tool loop or retry');
  }

  if (signals.size === 0) {
    signals.add('healthy completion');
  }

  return [...signals].sort();
}

function hasRepeatedTool(toolCalls: string[]): boolean {
  return new Set(toolCalls).size < toolCalls.length;
}
