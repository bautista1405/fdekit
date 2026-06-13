import { describe, expect, it } from 'vitest';
import { createOpenAIProvider, openaiProvider } from '../index.js';

describe('openaiProvider', () => {
  it('declares OpenAI env requirements', () => {
    const provider = openaiProvider({ model: 'gpt-5.4-mini', apiKeyEnv: 'TEST_OPENAI_KEY' });

    expect(provider).toMatchObject({
      name: 'openai',
      model: 'gpt-5.4-mini',
      apiKeyEnv: 'TEST_OPENAI_KEY',
    });
    expect(provider.env?.[0]).toMatchObject({
      name: 'TEST_OPENAI_KEY',
      required: true,
    });
  });

  it('plans a tool call through the Responses API', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const provider = createOpenAIProvider(openaiProvider({
      model: 'gpt-5.5',
      apiKeyEnv: 'TEST_OPENAI_KEY',
      apiBaseUrl: 'https://api.openai.test/v1/',
    }), {
      env: { TEST_OPENAI_KEY: 'sk-test' },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({
          output_text: JSON.stringify({
            type: 'tool_call',
            toolName: 'ticket.get',
            args: { ticketId: 'tick_1001' },
            reason: 'Need ticket context',
          }),
        });
      },
    });

    const step = await provider.planNextStep({
      deployment: {
        name: 'demo',
        providers: { openai: openaiProvider() },
        connectors: {},
        agents: { supportTriage: { provider: 'openai', instructions: './agent.md' } },
      },
      agentName: 'supportTriage',
      agent: { provider: 'openai', instructions: './agent.md' },
      input: { ticketId: 'tick_1001' },
      instructions: 'Classify tickets',
      toolResults: [],
      stepIndex: 0,
      maxSteps: 8,
    });

    expect(step).toEqual({
      type: 'tool_call',
      toolName: 'ticket.get',
      args: { ticketId: 'tick_1001' },
      reason: 'Need ticket context',
    });
    expect(calls[0].input).toBe('https://api.openai.test/v1/responses');
    expect(calls[0].init?.headers).toMatchObject({
      authorization: 'Bearer sk-test',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      model: 'gpt-5.5',
      max_output_tokens: 800,
    });
  });

  it('retries retryable OpenAI API responses before parsing the final response', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const provider = createOpenAIProvider(openaiProvider({
      model: 'gpt-5.5',
      apiKeyEnv: 'TEST_OPENAI_KEY',
      apiBaseUrl: 'https://api.openai.test/v1/',
    }), {
      env: { TEST_OPENAI_KEY: 'sk-test' },
      resilience: {
        retry: {
          maxAttempts: 2,
          initialDelayMs: 0,
        },
        circuitBreaker: {
          failureThreshold: 2,
        },
        sleep: async () => {},
      },
      fetch: async (input, init) => {
        calls.push({ input, init });

        if (calls.length === 1) {
          return Response.json({ error: { message: 'rate limited' } }, { status: 429 });
        }

        return Response.json({
          output_text: JSON.stringify({
            type: 'final',
            message: 'Recovered after retry',
          }),
        });
      },
    });

    await expect(provider.planNextStep({
      deployment: {
        name: 'demo',
        providers: { openai: openaiProvider() },
        connectors: {},
        agents: { supportTriage: { provider: 'openai', instructions: './agent.md' } },
      },
      agentName: 'supportTriage',
      agent: { provider: 'openai', instructions: './agent.md' },
      input: {},
      instructions: 'Classify tickets',
      toolResults: [],
      stepIndex: 0,
      maxSteps: 8,
    })).resolves.toEqual({
      type: 'final',
      message: 'Recovered after retry',
    });
    expect(calls).toHaveLength(2);
  });

  it('routes planner calls through an injected SDK client without an API key', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = {
      responses: {
        async create(params: Record<string, unknown>) {
          calls.push(params);
          return {
            output_text: JSON.stringify({ type: 'final', message: 'Resolved via SDK client' }),
          };
        },
      },
    };
    const config = openaiProvider({ client });

    expect(config.env?.[0]).toMatchObject({ required: false });

    const provider = createOpenAIProvider(config, {
      env: {},
      fetch: async () => {
        throw new Error('fetch should not be called when a client is injected');
      },
    });

    const step = await provider.planNextStep({
      deployment: {
        name: 'demo',
        providers: { openai: config },
        connectors: {},
        agents: { supportTriage: { provider: 'openai', instructions: './agent.md' } },
      },
      agentName: 'supportTriage',
      agent: { provider: 'openai', instructions: './agent.md' },
      input: {},
      instructions: 'Classify tickets',
      toolResults: [],
      stepIndex: 0,
      maxSteps: 8,
    });

    expect(step).toEqual({ type: 'final', message: 'Resolved via SDK client' });
    expect(calls[0]).toMatchObject({
      model: 'gpt-5.5',
      max_output_tokens: 800,
    });
  });

  it('requires an OpenAI API key before making a request', async () => {
    const provider = createOpenAIProvider(openaiProvider({ apiKeyEnv: 'TEST_OPENAI_KEY' }), {
      env: {},
      fetch: async () => Response.json({}),
    });

    await expect(provider.planNextStep({
      deployment: {
        name: 'demo',
        providers: { openai: openaiProvider() },
        connectors: {},
        agents: { supportTriage: { provider: 'openai', instructions: './agent.md' } },
      },
      agentName: 'supportTriage',
      agent: { provider: 'openai', instructions: './agent.md' },
      input: {},
      instructions: 'Classify tickets',
      toolResults: [],
      stepIndex: 0,
      maxSteps: 8,
    })).rejects.toThrow('Missing OpenAI API key');
  });
});
