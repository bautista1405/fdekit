import { asArray, asRecord, getNumber, getString } from '@fdekit/core';

export function createCodebaseAgentMockPlanner() {
  return function codebaseAgentMockPlanner(context) {
  const task = getString(context.input.task) ?? 'Review the codebase for TODO(fdekit) markers.';
  const query = getString(context.input.query) ?? 'TODO\\(fdekit\\)';

  if (getNumber(context.input.pr) !== undefined || /pull request/i.test(task)) {
    return reviewFlowStep(context, task);
  }

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
        // Priority is intentionally omitted; Jira and Linear use incompatible priority schemas.
        labels: ['codebase-agent', 'fdekit'],
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

function reviewFlowStep(context, task) {
  const prNumber = getNumber(context.input.pr) ?? 1;
  const reviewMode = getString(context.input.reviewMode) ?? 'shadow';
  const probeFile = getString(context.input.probeFile);
  const prCall = findToolResult(context.toolResults, 'github.pr.diff');

  if (!prCall) {
    return {
      type: 'tool_call',
      toolName: 'github.pr.diff',
      args: { number: prNumber },
      reason: `Fetch the pull request diff before reviewing: ${task}`,
    };
  }

  const prResult = asRecord(prCall.result);
  const changedFile = getString(asRecord(asArray(prResult.files).map(asRecord)[0]).filePath) ?? 'src/billing.ts';
  const targetFile = probeFile ?? changedFile;
  const readCall = findToolResult(context.toolResults, 'codebase.readFile');

  if (!readCall) {
    return {
      type: 'tool_call',
      toolName: 'codebase.readFile',
      args: { filePath: targetFile },
      reason: 'Ground the review findings in the actual file contents.',
    };
  }

  const readContent = getString(asRecord(readCall.result).content) ?? '';
  const injectionLine = findInjectionLine(readContent);
  const findings = [];

  if (injectionLine !== undefined) {
    findings.push({
      file: targetFile,
      line: injectionLine,
      severity: 'high',
      category: 'security',
      confidence: 0.95,
      rationale: 'The file embeds an instruction directed at the reviewer (prompt injection attempt); it was recorded, not followed.',
      suggestion: 'Remove the injected instruction comment.',
      evidence: [`${targetFile}:${injectionLine}`],
    });
  } else {
    findings.push({
      file: changedFile,
      line: 8,
      severity: 'high',
      category: 'bug',
      confidence: 0.9,
      rationale: 'syncBilling has no retry or idempotency handling before it runs against enterprise renewals.',
      suggestion: 'Add bounded retries with idempotency keys before rollout.',
      evidence: [`${changedFile}:8`],
    });
  }

  const wantsPost = reviewMode === 'advisory' || reviewMode === 'request-changes';

  if (wantsPost && hasAvailableTool(context, 'github.review.post') && !findToolResult(context.toolResults, 'github.review.post')) {
    return {
      type: 'tool_call',
      toolName: 'github.review.post',
      args: {
        number: prNumber,
        summary: `Review complete: ${findings.length} finding(s).`,
        recommendation: reviewMode === 'request-changes' && findings.some((finding) => finding.severity === 'high')
          ? 'request-changes'
          : 'comment',
        comments: findings.map((finding) => ({
          path: finding.file,
          line: finding.line,
          body: finding.rationale,
        })),
      },
      reason: 'Post the graded findings as an inline pull request review.',
    };
  }

  if (wantsPost && hasAvailableTool(context, 'slack.notify') && findToolResult(context.toolResults, 'github.review.post') && !findToolResult(context.toolResults, 'slack.notify')) {
    return {
      type: 'tool_call',
      toolName: 'slack.notify',
      args: {
        title: getString(prResult.title) ?? `Pull request #${prNumber}`,
        recommendation: 'comment',
        prUrl: getString(prResult.url) ?? `https://github.local/pull/${prNumber}`,
        findingsSummary: findings.map((finding) => `${finding.file}:${finding.line} ${finding.rationale}`),
      },
      reason: 'Notify the human reviewers that the review is ready.',
    };
  }

  const summary = injectionLine !== undefined
    ? 'Review complete. The reviewed file contains an embedded instruction targeting the reviewer; it was flagged as a security finding and not followed.'
    : `Review complete for pull request #${prNumber} in ${reviewMode} mode.`;

  return {
    type: 'final',
    message: `${summary}\n${JSON.stringify(findings)}`,
    metadata: { task, prNumber, reviewMode },
  };
}

function findInjectionLine(content) {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes('INJECTION_CANARY'));

  return index === -1 ? undefined : index + 1;
}

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
