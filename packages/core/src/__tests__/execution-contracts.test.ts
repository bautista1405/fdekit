import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  EXECUTION_CONTRACT_VERSION,
  EXECUTION_STATES,
  TERMINAL_EXECUTION_STATES,
  UnsupportedExecutionContractVersionError,
  assertExecutionContractVersion,
  isExecutionState,
  isTerminalExecutionState,
  type ContextEnvelope,
  type ExecutionState,
  type InputRequestRecord,
  type PlannedAction,
} from '../index.js';

describe('shared execution contracts', () => {
  it('exports the exact canonical state vocabulary', () => {
    expect(EXECUTION_STATES).toEqual([
      'queued',
      'planning',
      'running',
      'needs_input',
      'needs_approval',
      'reconciling',
      'completed',
      'completed_with_limits',
      'failed',
      'cancelled',
      'expired',
    ]);
    expect(TERMINAL_EXECUTION_STATES).toEqual([
      'completed',
      'completed_with_limits',
      'failed',
      'cancelled',
      'expired',
    ]);
    expectTypeOf<ExecutionState>().toEqualTypeOf<(typeof EXECUTION_STATES)[number]>();
  });

  it('recognizes execution and terminal states', () => {
    expect(isExecutionState('needs_approval')).toBe(true);
    expect(isExecutionState('paused')).toBe(false);
    expect(isTerminalExecutionState('completed_with_limits')).toBe(true);
    expect(isTerminalExecutionState('running')).toBe(false);
  });

  it('rejects incompatible contract versions with a typed error', () => {
    expect(() => assertExecutionContractVersion(EXECUTION_CONTRACT_VERSION)).not.toThrow();
    expect(() => assertExecutionContractVersion(2)).toThrow(UnsupportedExecutionContractVersionError);
    expect(() => assertExecutionContractVersion(undefined)).toThrow(
      'Unsupported execution contract version: undefined',
    );
  });

  it('round-trips the host envelope while keeping model-visible context allowlisted', () => {
    const envelope: ContextEnvelope = {
      schemaVersion: EXECUTION_CONTRACT_VERSION,
      identity: { taskId: 'task-1', runId: 'run-1', attemptId: 'attempt-1', stepId: 'step-1' },
      tenant: {
        organizationId: 'org-1',
        sourceIds: ['repo-1'],
        permissionFingerprint: 'permissions-sha256',
      },
      actor: { id: 'service-1', kind: 'service_principal', roles: ['reviewer'] },
      task: { type: 'code-review', objective: 'Review the proposed change' },
      step: { id: 'step-1', index: 0, objective: 'Inspect immutable source' },
      session: { sessionId: 'session-1', revision: 3 },
      budget: {
        maxInputTokens: 8_000,
        maxOutputTokens: 2_000,
        maxToolCalls: 10,
        maxDurationMs: 60_000,
        maxDelegations: 0,
      },
      objectives: {
        relevance: 1,
        freshness: 1,
        authority: 1,
        completeness: 0.8,
        latency: 0.5,
        cost: 0.5,
      },
      policy: {
        schemaVersion: EXECUTION_CONTRACT_VERSION,
        version: 'review-policy.v1',
        fingerprint: 'policy-sha256',
        evaluatedAt: '2026-08-19T12:00:00.000Z',
        decision: 'allow',
        capabilities: ['source:read', 'tool:execute'],
        approvalRequiredFor: ['external:write'],
        sourceAllowlist: ['repo-1'],
        budget: { maxInputTokens: 8_000, maxToolCalls: 10 },
        reasons: ['Read-only review is allowed.'],
      },
      provenance: [
        {
          schemaVersion: EXECUTION_CONTRACT_VERSION,
          id: 'provenance-1',
          source: 'github',
          recordedAt: '2026-08-19T12:00:00.000Z',
          sourceSnapshot: {
            sourceId: 'repo-1',
            revision: 'commit-sha',
            observedAt: '2026-08-19T11:59:00.000Z',
          },
        },
      ],
      trace: { traceId: 'trace-1', spanId: 'span-1' },
      model: {
        schemaVersion: EXECUTION_CONTRACT_VERSION,
        instructions: [],
        evidence: [],
        memory: [],
        skills: [],
        tools: [],
        recentActions: [],
      },
    };

    const restored = JSON.parse(JSON.stringify(envelope)) as ContextEnvelope;

    expect(restored).toEqual(envelope);
    expect(Object.keys(restored.model).sort()).toEqual([
      'evidence',
      'instructions',
      'memory',
      'recentActions',
      'schemaVersion',
      'skills',
      'tools',
    ]);
    expect(restored.model).not.toHaveProperty('actor');
    expect(restored.model).not.toHaveProperty('credentials');
    expect(restored.model).not.toHaveProperty('policy');
    expect(restored.model).not.toHaveProperty('tenant');
    expect(restored.model).not.toHaveProperty('trace');
  });

  it('binds approval and input records to exact execution and action identity', () => {
    const action: PlannedAction = {
      schemaVersion: EXECUTION_CONTRACT_VERSION,
      actionId: 'action-1',
      identity: { taskId: 'task-1', runId: 'run-1', attemptId: 'attempt-1', stepId: 'step-1' },
      capability: 'external:write',
      target: 'github:owner/repository:refs/heads/main',
      operation: 'change-set.publish',
      argumentsDigest: 'sha256:arguments',
      sourceSnapshots: [
        {
          sourceId: 'github:owner/repository',
          revision: 'old-object-id',
          observedAt: '2026-08-19T12:00:00.000Z',
        },
      ],
      idempotencyKey: 'task-1:run-1:action-1',
      plannedAt: '2026-08-19T12:01:00.000Z',
    };
    const input: InputRequestRecord<string> = {
      schemaVersion: EXECUTION_CONTRACT_VERSION,
      requestId: 'input-1',
      identity: action.identity,
      session: { sessionId: 'session-1', revision: 4 },
      status: 'pending',
      prompt: 'Choose the publication target.',
      inputSchema: { type: 'string', enum: ['pull-request', 'branch'] },
      requestedAt: '2026-08-19T12:02:00.000Z',
      requestedBy: { id: 'system', kind: 'system' },
    };

    expect(action.sourceSnapshots[0]?.revision).toBe('old-object-id');
    expect(input.inputSchema.enum).toEqual(['pull-request', 'branch']);
  });
});
