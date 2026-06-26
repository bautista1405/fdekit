import type { ReadinessSignal } from '../../interfaces/index.js';

export function createReadinessSignals(input: {
  evalStatus: string;
  evalCaseCount: number;
  evalPassedCases: number;
  traceCount: number;
  externalActionCount: number;
  policyEvaluations: number;
  policyViolationCount: number;
  approvalQueueCount: number;
  reportReady: boolean;
  enforcementMode: 'enforced' | 'advisory' | 'unknown';
}): ReadinessSignal[] {
  const enforcementQualifier = input.enforcementMode === 'advisory'
    ? ', advisory mode - not enforced'
    : '';

  return [
    {
      label: 'Evals',
      status: input.evalStatus === 'passed' ? 'pass' : input.evalCaseCount > 0 ? 'fail' : 'warn',
      detail: input.evalCaseCount > 0
        ? `${input.evalPassedCases}/${input.evalCaseCount} cases passed`
        : 'no eval artifact found',
    },
    {
      label: 'Trace Evidence',
      status: input.traceCount > 0 ? 'pass' : 'warn',
      detail: `${input.traceCount} run trace(s) captured`,
    },
    {
      label: 'Customer Systems',
      status: input.externalActionCount > 0 ? 'pass' : 'warn',
      detail: `${input.externalActionCount} customer-system evidence event(s) captured`,
    },
    {
      label: 'Governance',
      status: input.policyViolationCount === 0 && input.approvalQueueCount === 0
        ? input.policyEvaluations > 0 ? 'pass' : 'warn'
        : 'fail',
      detail: `${input.policyEvaluations} checks, ${input.policyViolationCount} violation(s)${enforcementQualifier}, ${input.approvalQueueCount} approval item(s)`,
    },
    {
      label: 'Customer Report',
      status: input.reportReady ? 'pass' : 'warn',
      detail: input.reportReady ? 'report artifact created' : 'generate report before handoff',
    },
  ];
}

export function calculateReadinessScore(signals: ReadinessSignal[]): number {
  if (signals.length === 0) {
    return 0;
  }

  const weights: Record<ReadinessSignal['status'], number> = {
    pass: 1,
    warn: 0.55,
    fail: 0,
  };
  const score = signals.reduce((total, signal) => total + weights[signal.status], 0) / signals.length;

  return Math.round(score * 100);
}
