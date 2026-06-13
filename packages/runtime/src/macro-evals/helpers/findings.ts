import type { EvalCaseResult, EvalSuiteResult } from '../../evals/index.js';
import type { MacroEvalFinding } from '../interfaces/index.js';

export function findingsFromEvalCase(suite: EvalSuiteResult, evalCase: EvalCaseResult): MacroEvalFinding[] {
  const findings = evalCase.assertions
    .filter((assertion) => !assertion.passed)
    .map((assertion): MacroEvalFinding => ({
      category: categorizeFinding(assertion.message ?? suite.name),
      message: assertion.message ?? `Lower-level eval failed in ${suite.name}`,
      severity: 'high',
      source: 'eval',
    }));

  if (evalCase.status === 'failed' && findings.length === 0) {
    findings.push({
      category: 'lower-level eval failure',
      message: `Case "${evalCase.name}" failed without assertion detail`,
      severity: 'high',
      source: 'eval',
    });
  }

  return findings;
}

export function runOutcomeFindings(runOutcome: string): MacroEvalFinding[] {
  if (runOutcome === 'completed') {
    return [];
  }

  return [
    {
      category: runOutcome === 'waiting_approval' ? 'human review' : 'run outcome',
      message: `Run ended with outcome "${runOutcome}"`,
      severity: runOutcome === 'waiting_approval' ? 'medium' : 'high',
      source: 'trace',
    },
  ];
}

function categorizeFinding(message: string): string {
  const text = message.toLowerCase();

  if (text.includes('tool') || text.includes('call') || text.includes('escalation')) {
    return 'escalation routing';
  }

  if (text.includes('policy') || text.includes('violation') || text.includes('guardrail')) {
    return 'policy or guardrail';
  }

  if (text.includes('approval') || text.includes('review')) {
    return 'human review';
  }

  if (text.includes('latency') || text.includes('ms')) {
    return 'latency';
  }

  if (text.includes('cost') || text.includes('$')) {
    return 'cost';
  }

  if (text.includes('final answer') || text.includes('matched')) {
    return 'answer quality';
  }

  return 'lower-level eval failure';
}
