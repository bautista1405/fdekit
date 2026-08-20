import type { ExecutionState } from '@fdekit/core';

const transitions: Readonly<Record<ExecutionState, readonly ExecutionState[]>> = {
  queued: ['planning', 'running', 'failed', 'cancelled', 'expired'],
  planning: [
    'running',
    'needs_input',
    'needs_approval',
    'completed',
    'completed_with_limits',
    'failed',
    'cancelled',
    'expired',
  ],
  running: [
    'planning',
    'needs_input',
    'needs_approval',
    'reconciling',
    'completed',
    'completed_with_limits',
    'failed',
    'cancelled',
    'expired',
  ],
  needs_input: ['planning', 'running', 'failed', 'cancelled', 'expired'],
  needs_approval: ['running', 'reconciling', 'failed', 'cancelled', 'expired'],
  reconciling: [
    'running',
    'needs_approval',
    'completed',
    'completed_with_limits',
    'failed',
    'cancelled',
    'expired',
  ],
  completed: [],
  completed_with_limits: [],
  failed: [],
  cancelled: [],
  expired: [],
};

export function allowedExecutionStateTransitions(state: ExecutionState): readonly ExecutionState[] {
  return transitions[state];
}

export function canTransitionExecutionState(from: ExecutionState, to: ExecutionState): boolean {
  return from === to || transitions[from].includes(to);
}

export class InvalidExecutionStateTransitionError extends Error {
  constructor(
    readonly from: ExecutionState,
    readonly to: ExecutionState,
  ) {
    super(`Invalid execution state transition: ${from} -> ${to}.`);
    this.name = 'InvalidExecutionStateTransitionError';
  }
}

export function assertExecutionStateTransition(from: ExecutionState, to: ExecutionState): void {
  if (!canTransitionExecutionState(from, to)) {
    throw new InvalidExecutionStateTransitionError(from, to);
  }
}
