import { describe, expect, it } from 'vitest';
import type { ProviderPlanContext } from '@fdekit/core';
import { createMockProvider } from '../index.js';

describe('createMockProvider', () => {
  it('returns a generic final answer when no planner is configured', async () => {
    const provider = createMockProvider();

    await expect(Promise.resolve(provider.planNextStep(context({ task: 'summarize the local fixture' })))).resolves.toEqual({
      type: 'final',
      message: 'Mock provider completed: summarize the local fixture',
    });
  });

  it('uses an explicit planner for deterministic tool-call flows', async () => {
    const provider = createMockProvider({
      planner(planContext) {
        return planContext.toolResults.length === 0
          ? {
              type: 'tool_call',
              toolName: 'fixture.lookup',
              args: { id: planContext.input.id },
              reason: 'Load fixture data before returning',
            }
          : {
              type: 'final',
              message: 'Fixture data loaded',
            };
      },
    });

    await expect(Promise.resolve(provider.planNextStep(context({ id: 'fix_123' })))).resolves.toMatchObject({
      type: 'tool_call',
      toolName: 'fixture.lookup',
      args: { id: 'fix_123' },
    });

    await expect(Promise.resolve(provider.planNextStep({
      ...context({ id: 'fix_123' }),
      toolResults: [
        {
          name: 'fixture.lookup',
          args: { id: 'fix_123' },
          result: { ok: true },
          latencyMs: 1,
        },
      ],
    }))).resolves.toEqual({
      type: 'final',
      message: 'Fixture data loaded',
    });
  });
});

function context(input: Record<string, unknown> = {}): ProviderPlanContext {
  return {
    deployment: {
      name: 'test',
      providers: { mock: { name: 'mock' } },
      agents: {
        worker: {
          provider: 'mock',
          instructions: 'test',
        },
      },
    },
    agentName: 'worker',
    agent: {
      provider: 'mock',
      instructions: 'test',
    },
    input,
    instructions: 'test',
    toolResults: [],
    stepIndex: 0,
    maxSteps: 8,
  };
}
