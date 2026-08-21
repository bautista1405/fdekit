let serialized = '';
for await (const chunk of process.stdin) serialized += chunk;
const input = JSON.parse(serialized);
if (input.schemaVersion !== 1 || !Array.isArray(input.documents)) {
  throw new Error('Unsupported documentation skill input');
}

const findings = [];
const proposedChanges = [];
const validations = [];
for (const document of input.documents) {
  const hasExample = /```[\s\S]*?```/.test(document.content);
  const mentionsFuture = /\b(will|planned|roadmap|future)\b/i.test(document.content);
  const labelsProposal = /\b(proposed|not yet implemented)\b/i.test(document.content);
  if (!hasExample) {
    findings.push({
      code: 'missing-verified-example',
      path: document.path,
      severity: 'warning',
      message: 'The document has no fenced example that can be validated.',
    });
  }
  if (mentionsFuture && !labelsProposal) {
    findings.push({
      code: 'future-behavior-unlabelled',
      path: document.path,
      severity: 'error',
      message: 'Future behavior is not clearly separated from implemented behavior.',
    });
    proposedChanges.push({
      path: document.path,
      content: `${document.content.trimEnd()}\n\n> Proposed behavior below is not yet implemented.\n`,
      reason: 'Make the implementation boundary explicit for readers.',
    });
  }
  validations.push({
    name: `${document.path}:implementation-boundary`,
    status: mentionsFuture && !labelsProposal ? 'failed' : 'passed',
  });
  validations.push({
    name: `${document.path}:example-present`,
    status: hasExample ? 'passed' : 'not_run',
    ...(!hasExample ? { message: 'No fenced example was available to validate.' } : {}),
  });
}

process.stdout.write(JSON.stringify({
  summary: `${findings.length} documentation finding(s); ${proposedChanges.length} shadow change(s) proposed.`,
  findings,
  proposedChanges,
  validations,
}));
