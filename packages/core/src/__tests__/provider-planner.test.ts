import { describe, expect, it } from 'vitest';
import type { ProviderPlanContext } from '../types/index.js';
import {
  buildProviderPlannerInput,
  buildProviderPlannerInputPayload,
  buildProviderPlannerInstructions,
  compactRecord,
  normalizeBaseUrl,
  parseProviderPlannerStep,
  providerErrorMessage,
} from '../provider-planner/index.js';

describe('provider planner protocol helpers', () => {
  it('builds deterministic planner instructions and input payloads', () => {
    const context = planContext();

    expect(buildProviderPlannerInstructions(context)).toContain('Return only strict JSON');
    expect(buildProviderPlannerInstructions(context)).toContain('"is_error": true');
    expect(buildProviderPlannerInstructions(context)).toContain('Find TODO markers');

    expect(buildProviderPlannerInputPayload(context)).toMatchObject({
      deployment: 'demo',
      agent: 'reviewer',
      input: { query: 'TODO' },
      stepIndex: 1,
      maxSteps: 4,
      availableTools: [
        {
          name: 'codebase.search',
          category: 'codebase',
          tags: ['context', 'search'],
          scopes: ['codebase:read'],
        },
        {
          name: 'issue.create',
          category: 'issue',
          tags: ['action', 'escalation'],
          scopes: ['issues:write'],
        },
      ],
    });

    expect(JSON.parse(buildProviderPlannerInput(context))).toMatchObject({
      deployment: 'demo',
      availableTools: [
        { name: 'codebase.search' },
        { name: 'issue.create' },
      ],
    });
  });

  it('parses final and tool-call provider steps from strict JSON', () => {
    expect(parseProviderPlannerStep('{"type":"final","message":"done"}', 'TestProvider')).toEqual({
      type: 'final',
      message: 'done',
    });

    expect(parseProviderPlannerStep(
      'Plan:\n{"type":"tool_call","toolName":"codebase.search","args":{"query":"TODO"},"reason":"find work"}',
      'TestProvider',
    )).toEqual({
      type: 'tool_call',
      toolName: 'codebase.search',
      args: { query: 'TODO' },
      reason: 'find work',
    });
  });

  it('fails provider planner parsing explicitly', () => {
    expect(() => parseProviderPlannerStep('not json', 'TestProvider')).toThrow(
      'TestProvider response was not JSON',
    );
    expect(() => parseProviderPlannerStep('{"type":"final"}', 'TestProvider')).toThrow(
      'TestProvider final step is missing a message',
    );
    expect(() => parseProviderPlannerStep('{"type":"tool_call","args":{}}', 'TestProvider')).toThrow(
      'TestProvider tool call step is missing toolName',
    );
  });

  it('normalizes provider wire helpers', () => {
    expect(normalizeBaseUrl('https://api.example.com/')).toBe('https://api.example.com');
    expect(compactRecord({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null });
    expect(providerErrorMessage({ error: { message: 'bad key' } }, response(401, 'Unauthorized'))).toBe('bad key');
    expect(providerErrorMessage({ message: 'server unavailable' }, response(503, 'Unavailable'))).toBe(
      'server unavailable',
    );
  });
});

function planContext(): ProviderPlanContext {
  return {
    deployment: {
      name: 'demo',
      providers: {},
      connectors: {
        codebase: {
          name: 'codebase',
          tools: [
            {
              name: 'codebase.search',
              description: 'Search files',
              scopes: ['codebase:read'],
              category: 'codebase',
              tags: ['context', 'search'],
              argsSchema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string' },
                },
              },
              handler: () => null,
            },
          ],
        },
      },
      agents: {
        reviewer: {
          instructions: 'Find TODO markers',
          tools: [
            {
              name: 'issue.create',
              scopes: ['issues:write'],
              category: 'issue',
              tags: ['action', 'escalation'],
              handler: () => null,
            },
          ],
        },
      },
    },
    agentName: 'reviewer',
    agent: {
      instructions: 'Find TODO markers',
      tools: [
        {
          name: 'issue.create',
          scopes: ['issues:write'],
          category: 'issue',
          tags: ['action', 'escalation'],
          handler: () => null,
        },
      ],
    },
    input: { query: 'TODO' },
    instructions: 'Find TODO markers',
    toolResults: [],
    stepIndex: 1,
    maxSteps: 4,
  };
}

function response(status: number, statusText: string): Response {
  return new Response(null, { status, statusText });
}
