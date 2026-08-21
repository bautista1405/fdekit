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

  it('parses final, tool-call, and structured-input provider steps from strict JSON', () => {
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

    expect(parseProviderPlannerStep(JSON.stringify({
      type: 'input_request',
      prompt: 'Which repository should be reviewed?',
      inputSchema: {
        type: 'object',
        required: ['repository'],
        properties: { repository: { type: 'string' } },
        additionalProperties: false,
      },
      disclosure: 'restricted',
    }), 'TestProvider')).toEqual({
      type: 'input_request',
      prompt: 'Which repository should be reviewed?',
      inputSchema: {
        type: 'object',
        required: ['repository'],
        properties: { repository: { type: 'string' } },
        additionalProperties: false,
      },
      disclosure: 'restricted',
    });
  });

  it('serializes only the allowlisted model context when a step plan is present', () => {
    const context: ProviderPlanContext = {
      ...planContext(),
      input: { hostSecret: 'must-not-leak' },
      instructions: 'Host-only instructions',
      toolResults: [{ name: 'host.tool', args: {}, result: { secret: 'hidden' }, latencyMs: 1 }],
      contextPlan: {
        schemaVersion: 1,
        target: {
          id: 'review-target',
          provider: 'provider-a',
          model: 'review-model',
          capabilities: {
            inputModalities: ['text'],
            outputModalities: ['text'],
            contextWindowTokens: 128_000,
            maxOutputTokens: 4_000,
            toolCalls: true,
            structuredOutput: true,
            streaming: true,
            reasoning: false,
            promptCaching: false,
          },
        },
        endpoint: {
          id: 'private-endpoint',
          provider: 'provider-a',
          credentialRef: 'secret://provider-a',
        },
        budget: { maxInputTokens: 8_000 },
        objectives: {
          relevance: 1,
          freshness: 1,
          authority: 1,
          completeness: 1,
          latency: 0,
          cost: 0,
        },
        inputTokenLimit: 8_000,
        estimatedInputTokens: 100,
        feasibility: { status: 'feasible', reasons: [] },
        model: {
          schemaVersion: 1,
          instructions: [{ id: 'instruction-1', kind: 'instruction', content: 'Allowlisted instruction' }],
          evidence: [{ id: 'evidence-1', kind: 'evidence', content: 'Allowlisted evidence' }],
          memory: [],
          skills: [],
          tools: [{ name: 'code.read', description: 'Read code', inputSchema: { type: 'object' } }],
          recentActions: [],
        },
        manifest: { schemaVersion: 1, selected: [], excluded: [] },
      },
    };

    const instructions = buildProviderPlannerInstructions(context);
    const payload = buildProviderPlannerInputPayload(context);
    const serialized = JSON.stringify(payload);

    expect(instructions).toContain('Allowlisted instruction');
    expect(instructions).not.toContain('Host-only instructions');
    expect(payload).not.toHaveProperty('deployment');
    expect(payload).not.toHaveProperty('agent');
    expect(payload).not.toHaveProperty('input');
    expect(payload.toolResults).toEqual([]);
    expect(payload.availableTools).toEqual([
      { name: 'code.read', description: 'Read code', argsSchema: { type: 'object' } },
    ]);
    expect(serialized).toContain('Allowlisted evidence');
    expect(serialized).not.toContain('must-not-leak');
    expect(serialized).not.toContain('private-endpoint');
    expect(serialized).not.toContain('secret://provider-a');
    expect(serialized).not.toContain('host.tool');
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
