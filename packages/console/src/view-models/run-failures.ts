export type RunFailureCategory = 'infra' | 'policy-block' | 'tool-error' | 'max-steps' | 'model-error' | 'other';

export interface RunFailureClassification {
  category: RunFailureCategory;
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
      label: FAILURE_LABELS.other,
      reason: 'No failure reason captured',
    };
  }

  const normalized = message.toLowerCase();
  const category = classifyFailureMessage(normalized);

  return {
    category,
    label: FAILURE_LABELS[category],
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

function classifyFailureMessage(normalized: string): RunFailureCategory {
  if (normalized.includes('policy') && (normalized.includes('blocked') || normalized.includes('violation'))) {
    return 'policy-block';
  }

  if (normalized.includes('tool call limit') || normalized.includes('max steps') || normalized.includes('maximum steps')) {
    return 'max-steps';
  }

  if (normalized.includes('args $.') || normalized.includes('required property') || normalized.includes('tool "')) {
    return 'tool-error';
  }

  if (normalized.includes('request failed')
    || normalized.includes('connection refused')
    || normalized.includes('econnrefused')
    || normalized.includes('timeout')
    || normalized.includes('http://127.0.0.1')
    || normalized.includes('http://localhost')) {
    return 'infra';
  }

  if (normalized.includes('model')
    || normalized.includes('provider')
    || normalized.includes('ollama')
    || normalized.includes('openai')
    || normalized.includes('anthropic')) {
    return 'model-error';
  }

  return 'other';
}
