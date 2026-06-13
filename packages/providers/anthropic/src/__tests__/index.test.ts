import { describe, expect, it } from 'vitest';
import { anthropicProvider, createAnthropicProvider } from '../index.js';

describe('anthropicProvider', () => {
  it('declares Anthropic env requirements', () => {
    const provider = anthropicProvider({ model: 'claude-opus-4-8', apiKeyEnv: 'TEST_ANTHROPIC_KEY' });

    expect(provider).toMatchObject({
      name: 'anthropic',
      model: 'claude-opus-4-8',
      apiKeyEnv: 'TEST_ANTHROPIC_KEY',
    });
    expect(provider.env?.[0]).toMatchObject({
      name: 'TEST_ANTHROPIC_KEY',
      required: true,
    });
  });

  it('plans a final step through the Messages API', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const provider = createAnthropicProvider(anthropicProvider({
      model: 'claude-opus-4-8',
      apiKeyEnv: 'TEST_ANTHROPIC_KEY',
      apiBaseUrl: 'https://api.anthropic.test/v1/',
    }), {
      env: { TEST_ANTHROPIC_KEY: 'sk-ant-test' },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                type: 'final',
                message: 'The ticket can stay in standard support',
              }),
            },
          ],
        });
      },
    });

    const step = await provider.planNextStep({
      deployment: {
        name: 'demo',
        providers: { anthropic: anthropicProvider() },
        connectors: {},
        agents: { supportTriage: { provider: 'anthropic', instructions: './agent.md' } },
      },
      agentName: 'supportTriage',
      agent: { provider: 'anthropic', instructions: './agent.md' },
      input: { ticketId: 'tick_1002' },
      instructions: 'Classify tickets',
      toolResults: [],
      stepIndex: 1,
      maxSteps: 8,
    });

    expect(step).toEqual({
      type: 'final',
      message: 'The ticket can stay in standard support',
    });
    expect(calls[0].input).toBe('https://api.anthropic.test/v1/messages');
    expect(calls[0].init?.headers).toMatchObject({
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'x-api-key': 'sk-ant-test',
    });
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      model: 'claude-opus-4-8',
      max_tokens: 800,
    });
  });

  it('routes planner calls through an injected SDK client without an API key', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = {
      messages: {
        async create(params: Record<string, unknown>) {
          calls.push(params);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ type: 'final', message: 'Resolved via SDK client' }),
              },
            ],
          };
        },
      },
    };
    const config = anthropicProvider({ client });

    expect(config.env?.[0]).toMatchObject({ required: false });

    const provider = createAnthropicProvider(config, {
      env: {},
      fetch: async () => {
        throw new Error('fetch should not be called when a client is injected');
      },
    });

    const step = await provider.planNextStep({
      deployment: {
        name: 'demo',
        providers: { anthropic: config },
        connectors: {},
        agents: { supportTriage: { provider: 'anthropic', instructions: './agent.md' } },
      },
      agentName: 'supportTriage',
      agent: { provider: 'anthropic', instructions: './agent.md' },
      input: { ticketId: 'tick_1002' },
      instructions: 'Classify tickets',
      toolResults: [],
      stepIndex: 0,
      maxSteps: 8,
    });

    expect(step).toEqual({ type: 'final', message: 'Resolved via SDK client' });
    expect(calls[0]).toMatchObject({
      model: 'claude-opus-4-8',
      max_tokens: 800,
    });
  });

  it('requires an Anthropic API key before making a request', async () => {
    const provider = createAnthropicProvider(anthropicProvider({ apiKeyEnv: 'TEST_ANTHROPIC_KEY' }), {
      env: {},
      fetch: async () => Response.json({}),
    });

    await expect(provider.planNextStep({
      deployment: {
        name: 'demo',
        providers: { anthropic: anthropicProvider() },
        connectors: {},
        agents: { supportTriage: { provider: 'anthropic', instructions: './agent.md' } },
      },
      agentName: 'supportTriage',
      agent: { provider: 'anthropic', instructions: './agent.md' },
      input: {},
      instructions: 'Classify tickets',
      toolResults: [],
      stepIndex: 0,
      maxSteps: 8,
    })).rejects.toThrow('Missing Anthropic API key');
  });
});
