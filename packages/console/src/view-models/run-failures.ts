export type RunFailureCategory = 'infra' | 'policy-block' | 'tool-error' | 'max-steps' | 'model-error' | 'other';
export type RunFailureReasonClass =
  | 'governance-block'
  | 'tool-limit-loop'
  | 'invalid-tool-json'
  | 'invalid-tool-args'
  | 'infra-error'
  | 'provider-error'
  | 'max-steps'
  | 'unknown';

export interface RunFailureClassification {
  category: RunFailureCategory;
  reasonClass: RunFailureReasonClass;
  label: string;
  reason: string;
}

const FAILURE_LABELS: Record<RunFailureCategory, string> = {
  infra: 'Infrastructure',
  'policy-block': 'Policy block',
  'tool-error': 'Tool error',
  'max-steps': 'Max steps',
  'model-error': 'Model error',
  other: 'Other',
};

export function classifyRunFailure(status: string, message: string | undefined): RunFailureClassification | undefined {
  if (!isFailureStatus(status)) {
    return undefined;
  }

  if (!message) {
    return {
      category: 'other',
      reasonClass: 'unknown',
      label: FAILURE_LABELS.other,
      reason: 'No failure reason captured',
    };
  }

  const normalized = message.toLowerCase();
  const classification = classifyFailureMessage(normalized);

  return {
    category: classification.category,
    reasonClass: classification.reasonClass,
    label: FAILURE_LABELS[classification.category],
    reason: message,
  };
}

function isFailureStatus(status: string): boolean {
  const normalized = status.toLowerCase();

  return normalized === 'failed'
    || normalized === 'fail'
    || normalized === 'blocked'
    || normalized === 'error';
}

function classifyFailureMessage(normalized: string): Pick<RunFailureClassification, 'category' | 'reasonClass'> {
  if (normalized.includes('tool call limit') || normalized.includes('limit-tool-use')) {
    return { category: 'policy-block', reasonClass: 'tool-limit-loop' };
  }

  if ((normalized.includes('json') && (normalized.includes('expected') || normalized.includes('invalid')))
    || normalized.includes('invalid tool-call json')
    || normalized.includes('invalid tool call json')
    || normalized.includes('json at position')) {
    return { category: 'model-error', reasonClass: 'invalid-tool-json' };
  }

  if (normalized.includes('policy') && (normalized.includes('blocked') || normalized.includes('violation'))) {
    return { category: 'policy-block', reasonClass: 'governance-block' };
  }

  if (normalized.includes('tool call limit') || normalized.includes('max steps') || normalized.includes('maximum steps')) {
    return { category: 'max-steps', reasonClass: 'max-steps' };
  }

  if (normalized.includes('args $.') || normalized.includes('required property') || normalized.includes('tool "')) {
    return { category: 'tool-error', reasonClass: 'invalid-tool-args' };
  }

  if (normalized.includes('request failed')
    || normalized.includes('connection refused')
    || normalized.includes('econnrefused')
    || normalized.includes('timeout')
    || normalized.includes('http://127.0.0.1')
    || normalized.includes('http://localhost')) {
    return { category: 'infra', reasonClass: 'infra-error' };
  }

  if (normalized.includes('model')
    || normalized.includes('provider')
    || normalized.includes('ollama')
    || normalized.includes('openai')
    || normalized.includes('anthropic')) {
    return { category: 'model-error', reasonClass: 'provider-error' };
  }

  return { category: 'other', reasonClass: 'unknown' };
}
