import { describe, expect, it } from 'vitest';
import type {
  ContextObjectives,
  EffectivePolicy,
  InferenceRouteCandidate,
} from '@fdekit/core';
import {
  authorizeRetrieval,
  planStepContext,
  reserveDelegationBudget,
  selectInferenceTarget,
} from '../context/index.js';

const objectives: ContextObjectives = {
  relevance: 1,
  freshness: 0.5,
  authority: 0.8,
  completeness: 0.5,
  latency: 0.2,
  cost: 0.2,
};

describe('policy-aware context planning', () => {
  it('authorizes source identities before content retrieval', () => {
    const policy = effectivePolicy();

    expect(authorizeRetrieval({
      policy,
      requestedSourceIds: ['repo-allowed'],
      evaluatedAt: '2026-08-19T12:00:00.000Z',
    })).toEqual({
      schemaVersion: 1,
      policyFingerprint: 'policy-fingerprint',
      decision: 'allow',
      createdAt: '2026-08-19T12:00:00.000Z',
      allowedSourceIds: ['repo-allowed'],
      deniedSources: [],
    });

    expect(authorizeRetrieval({
      policy,
      requestedSourceIds: ['repo-denied'],
    })).toMatchObject({
      decision: 'deny',
      allowedSourceIds: [],
      deniedSources: [{ sourceId: 'repo-denied', reason: 'source_not_allowed' }],
    });

    expect(authorizeRetrieval({
      policy: { ...policy, approvalRequiredFor: ['source:read'] },
      requestedSourceIds: ['repo-allowed'],
    })).toMatchObject({
      decision: 'needs_approval',
      deniedSources: [{ sourceId: 'repo-allowed', reason: 'approval_required' }],
    });
  });

  it('selects a capable target while keeping endpoint and credential references host-only', () => {
    const routes: InferenceRouteCandidate[] = [
      route('small', {
        contextWindowTokens: 8_000,
        toolCalls: false,
      }),
      route('capable', {
        contextWindowTokens: 128_000,
        toolCalls: true,
      }),
      {
        ...route('wrong-region', { contextWindowTokens: 128_000, toolCalls: true }),
        endpoint: {
          id: 'endpoint-wrong-region',
          provider: 'provider-a',
          credentialRef: 'secret://provider-a',
          region: 'eu-west',
        },
      },
    ];

    const selection = selectInferenceTarget(routes, {
      inputModalities: ['text'],
      outputModalities: ['text'],
      minimumContextTokens: 32_000,
      toolCalls: true,
      structuredOutput: true,
      allowedRegions: ['us-east'],
    });

    expect(selection).toMatchObject({
      status: 'selected',
      target: { id: 'capable' },
      endpoint: { id: 'endpoint-capable', credentialRef: 'secret://provider-a' },
    });
    expect(selection.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetId: 'small', reasons: expect.arrayContaining(['context_window_too_small']) }),
      expect.objectContaining({ targetId: 'wrong-region', reasons: ['region_not_allowed'] }),
    ]));
  });

  it('builds an allowlisted model context under token, retrieval, and tool limits', () => {
    const policy = effectivePolicy();
    const authorization = authorizeRetrieval({
      policy,
      requestedSourceIds: ['repo-allowed'],
      evaluatedAt: '2026-08-19T12:00:00.000Z',
    });
    const selectedRoute = route('capable', {
      contextWindowTokens: 100,
      maxOutputTokens: 30,
      toolCalls: true,
    });

    const plan = planStepContext({
      target: selectedRoute.target,
      endpoint: selectedRoute.endpoint,
      policy,
      authorization,
      budget: {
        maxInputTokens: 90,
        maxOutputTokens: 20,
        reservedTokens: 10,
        maxRetrievalItems: 1,
        maxToolCalls: 1,
      },
      objectives,
      items: [
        {
          item: { id: 'instructions', kind: 'instruction', content: 'Review only the supplied evidence.' },
          estimatedTokens: 20,
          required: true,
        },
        {
          item: {
            id: 'allowed-evidence',
            kind: 'evidence',
            content: 'Grounded repository evidence',
            sourceIds: ['repo-allowed'],
          },
          estimatedTokens: 30,
          priority: 5,
          scores: { relevance: 1, authority: 1 },
        },
        {
          item: {
            id: 'unauthorized-evidence',
            kind: 'evidence',
            content: 'Must never reach the model',
            sourceIds: ['repo-denied'],
          },
          estimatedTokens: 1,
          priority: 100,
        },
        {
          item: {
            id: 'second-evidence',
            kind: 'evidence',
            content: 'Over the retrieval item limit',
            sourceIds: ['repo-allowed'],
          },
          estimatedTokens: 1,
          priority: 4,
        },
      ],
      skills: [{ skill: { name: 'review', version: '1' }, estimatedTokens: 10, priority: 2 }],
      tools: [
        {
          tool: { name: 'code.read', description: 'Read code', inputSchema: { type: 'object' } },
          estimatedTokens: 10,
          priority: 1,
        },
        {
          tool: { name: 'code.write', description: 'Write code', inputSchema: { type: 'object' } },
          estimatedTokens: 1,
        },
      ],
    });

    expect(plan.inputTokenLimit).toBe(70);
    expect(plan.estimatedInputTokens).toBe(70);
    expect(plan.feasibility).toEqual({ status: 'feasible', reasons: [] });
    expect(plan.model.instructions.map((item) => item.id)).toEqual(['instructions']);
    expect(plan.model.evidence.map((item) => item.id)).toEqual(['allowed-evidence']);
    expect(plan.model.skills.map((skill) => skill.name)).toEqual(['review']);
    expect(plan.model.tools.map((tool) => tool.name)).toEqual(['code.read']);
    expect(JSON.stringify(plan.model)).not.toContain('Must never reach the model');
    expect(plan.model).not.toHaveProperty('endpoint');
    expect(plan.model).not.toHaveProperty('policy');
    expect(plan.manifest.excluded).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'unauthorized-evidence', reason: 'source_not_authorized' }),
      expect.objectContaining({ id: 'second-evidence', reason: 'retrieval_limit' }),
      expect.objectContaining({ id: 'code.write', reason: 'tool_limit' }),
    ]));
  });

  it('blocks the step when required context cannot fit or authorization is stale', () => {
    const policy = effectivePolicy();
    const selectedRoute = route('small-context', { contextWindowTokens: 40, maxOutputTokens: 20 });
    const authorized = authorizeRetrieval({ policy, requestedSourceIds: [] });

    const tooLarge = planStepContext({
      target: selectedRoute.target,
      endpoint: selectedRoute.endpoint,
      policy,
      authorization: authorized,
      budget: { maxInputTokens: 40, maxOutputTokens: 20 },
      objectives,
      items: [{
        item: { id: 'required', kind: 'instruction', content: 'Required instruction' },
        estimatedTokens: 21,
        required: true,
      }],
    });
    expect(tooLarge.feasibility.status).toBe('blocked');
    expect(tooLarge.manifest.excluded[0]).toMatchObject({ id: 'required', reason: 'token_budget' });

    const stale = planStepContext({
      target: selectedRoute.target,
      endpoint: selectedRoute.endpoint,
      policy,
      authorization: { ...authorized, policyFingerprint: 'old-policy' },
      budget: { maxInputTokens: 40, maxOutputTokens: 20 },
      objectives,
      items: [{
        item: { id: 'instruction', kind: 'instruction', content: 'Do not run under stale policy.' },
        estimatedTokens: 1,
      }],
    });
    expect(stale.feasibility.status).toBe('blocked');
    expect(stale.model.instructions).toEqual([]);
    expect(stale.manifest.excluded[0]?.reason).toBe('policy_denied');
  });

  it('blocks a target excluded by the effective policy allowlist', () => {
    const policy = { ...effectivePolicy(), targetAllowlist: ['approved-target'] };
    const selectedRoute = route('unapproved-target', {});
    const plan = planStepContext({
      target: selectedRoute.target,
      endpoint: selectedRoute.endpoint,
      policy,
      authorization: authorizeRetrieval({ policy, requestedSourceIds: [] }),
      budget: { maxInputTokens: 1_000 },
      objectives,
      items: [{
        item: { id: 'instruction', kind: 'instruction', content: 'Review the change.' },
        estimatedTokens: 4,
        required: true,
      }],
    });

    expect(plan.feasibility).toMatchObject({
      status: 'blocked',
      reasons: ['Inference target unapproved-target is not allowed by the effective policy.'],
    });
    expect(plan.model.instructions).toEqual([]);
  });

  it('deduplicates repeated semantic content and uses explicit compression only when opted in', () => {
    const policy = effectivePolicy();
    const selectedRoute = route('compressed', { contextWindowTokens: 50, maxOutputTokens: 20 });
    const plan = planStepContext({
      target: selectedRoute.target,
      endpoint: selectedRoute.endpoint,
      policy,
      authorization: authorizeRetrieval({ policy, requestedSourceIds: [] }),
      budget: { maxInputTokens: 50, maxOutputTokens: 20 },
      objectives,
      compression: { mode: 'when_needed' },
      items: [
        {
          item: { id: 'primary', kind: 'instruction', content: 'Keep this semantic rule.' },
          estimatedTokens: 20,
          priority: 2,
        },
        {
          item: { id: 'duplicate', kind: 'instruction', content: 'Keep   this semantic rule.' },
          estimatedTokens: 20,
          priority: 1,
        },
        {
          item: { id: 'large', kind: 'instruction', content: 'A long host-produced context value.' },
          estimatedTokens: 20,
          compressed: { content: 'Compact context.', estimatedTokens: 8, method: 'extractive-v1' },
        },
      ],
    });

    expect(plan.estimatedInputTokens).toBe(28);
    expect(plan.model.instructions).toEqual([
      expect.objectContaining({ id: 'primary', content: 'Keep this semantic rule.' }),
      expect.objectContaining({ id: 'large', content: 'Compact context.' }),
    ]);
    expect(plan.manifest.excluded).toContainEqual(expect.objectContaining({
      id: 'duplicate',
      reason: 'duplicate',
    }));
    expect(plan.manifest.selected).toContainEqual(expect.objectContaining({
      id: 'large',
      estimatedTokens: 8,
      originalEstimatedTokens: 20,
      compression: { method: 'extractive-v1', savedTokens: 12 },
    }));
  });

  it('reserves delegation slots before an orchestrator dispatches work', () => {
    expect(reserveDelegationBudget({ maxDelegations: 2 }, 0)).toBe(1);
    expect(reserveDelegationBudget({ maxDelegations: 2 }, 1)).toBe(2);
    expect(() => reserveDelegationBudget({ maxDelegations: 2 }, 2)).toThrow(
      'Delegation budget exceeded: 3 requested, limit 2',
    );
  });

  it('requires approval when the effective execution policy does, even without retrieval', () => {
    const policy: EffectivePolicy = {
      ...effectivePolicy(),
      decision: 'needs_approval',
      reasons: ['Execution requires reviewer approval'],
    };
    const selectedRoute = route('approved-target', {});
    const plan = planStepContext({
      target: selectedRoute.target,
      endpoint: selectedRoute.endpoint,
      policy,
      authorization: authorizeRetrieval({ policy, requestedSourceIds: [] }),
      budget: { maxInputTokens: 1_000 },
      objectives,
      items: [{
        item: { id: 'instruction', kind: 'instruction', content: 'Wait for approval.' },
        estimatedTokens: 4,
        required: true,
      }],
    });

    expect(plan.feasibility).toMatchObject({
      status: 'needs_approval',
      reasons: ['Effective policy requires approval before execution.'],
    });
    expect(plan.model.instructions).toEqual([]);
  });
});

function effectivePolicy(): EffectivePolicy {
  return {
    schemaVersion: 1,
    version: 'test-policy.v1',
    fingerprint: 'policy-fingerprint',
    evaluatedAt: '2026-08-19T12:00:00.000Z',
    decision: 'allow',
    capabilities: ['source:read', 'tool:execute'],
    approvalRequiredFor: [],
    sourceAllowlist: ['repo-allowed'],
    budget: { maxInputTokens: 1_000 },
    reasons: ['Test policy'],
  };
}

function route(
  id: string,
  overrides: Partial<InferenceRouteCandidate['target']['capabilities']>,
): InferenceRouteCandidate {
  return {
    target: {
      id,
      provider: 'provider-a',
      model: `model-${id}`,
      capabilities: {
        inputModalities: ['text'],
        outputModalities: ['text'],
        contextWindowTokens: 32_000,
        maxOutputTokens: 4_000,
        toolCalls: true,
        structuredOutput: true,
        streaming: true,
        reasoning: false,
        promptCaching: false,
        ...overrides,
      },
    },
    endpoint: {
      id: `endpoint-${id}`,
      provider: 'provider-a',
      credentialRef: 'secret://provider-a',
      region: 'us-east',
    },
  };
}
