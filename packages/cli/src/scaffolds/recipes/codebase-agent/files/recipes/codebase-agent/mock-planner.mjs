import { asArray, asRecord, getNumber, getString } from '@fdekit/core';

export function createCodebaseAgentMockPlanner() {
  return function codebaseAgentMockPlanner(context) {
  const task = getString(context.input.task) ?? 'Review the codebase for TODO(fdekit) markers.';
  const query = getString(context.input.query) ?? 'TODO(fdekit)';
  const searchCall = findToolResult(context.toolResults, 'codebase.search');

  if (!searchCall) {
    return {
      type: 'tool_call',
      toolName: 'codebase.search',
      args: {
        query,
        maxResults: 5,
      },
      reason: `Search the codebase before responding to: ${task}`,
    };
  }

  const matches = asArray(asRecord(searchCall.result).matches).map(asRecord);
  const firstMatch = matches[0];
  const filePath = getString(firstMatch?.filePath);
  const preview = getString(firstMatch?.preview) ?? query;

  if (!filePath) {
    return {
      type: 'final',
      message: `No codebase findings matched "${query}".`,
    };
  }

  const readCall = findToolResult(context.toolResults, 'codebase.readFile');

  if (!readCall) {
    return {
      type: 'tool_call',
      toolName: 'codebase.readFile',
      args: {
        filePath,
        startLine: Math.max(getNumber(firstMatch.line) ?? 1, 1),
        endLine: Math.max(getNumber(firstMatch.line) ?? 1, 1),
      },
      reason: 'Read the matching code line before creating a handoff.',
    };
  }

  if (hasAvailableTool(context, 'issue.create') && !findToolResult(context.toolResults, 'issue.create')) {
    return {
      type: 'tool_call',
      toolName: 'issue.create',
      args: {
        title: `[codebase] Review ${filePath}`,
        body: [
          `Task: ${task}`,
          `Finding: ${preview}`,
          `File: ${filePath}`,
        ].join('\n'),
        labels: ['codebase-agent', 'fdekit'],
        priority: 'normal',
      },
      reason: 'Create an engineering issue for the codebase finding.',
    };
  }

  return {
    type: 'final',
    message: `Codebase review found "${preview}" in ${filePath}. ${hasAvailableTool(context, 'issue.create') ? 'Created an engineering issue for follow-up.' : 'No issue connector was configured, so this is a report-only finding.'}`,
    metadata: {
      task,
      query,
      filePath,
      preview,
    },
  };
};

function findToolResult(toolResults, toolName) {
  return toolResults.find((result) => result.name === toolName);
}

function hasAvailableTool(context, toolName) {
  const connectorTools = Object.values(context.deployment.connectors ?? {})
    .flatMap((connector) => connector.tools ?? []);
  const agentTools = context.agent.tools ?? [];

  return [...connectorTools, ...agentTools].some((tool) => tool.name === toolName);
}
}
