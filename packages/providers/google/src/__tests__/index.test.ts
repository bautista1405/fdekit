import { describe, expect, it } from 'vitest';
import { createGoogleProvider, googleProvider } from '../index.js';

describe('googleProvider', () => {
  it('declares Google Gemini env requirements', () => {
    const provider = googleProvider({ model: 'gemini-3.5-flash', apiKeyEnv: 'TEST_GEMINI_KEY' });

    expect(provider).toMatchObject({
      name: 'google',
      model: 'gemini-3.5-flash',
      apiKeyEnv: 'TEST_GEMINI_KEY',
    });
    expect(provider.env?.[0]).toMatchObject({
      name: 'TEST_GEMINI_KEY',
      required: true,
    });
  });

  it('plans a tool call through the Gemini generateContent API', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const provider = createGoogleProvider(googleProvider({
      model: 'gemini-3.5-flash',
      apiKeyEnv: 'TEST_GEMINI_KEY',
      apiBaseUrl: 'https://generativelanguage.test/v1beta/',
    }), {
      env: { TEST_GEMINI_KEY: 'gemini-test' },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      type: 'tool_call',
                      toolName: 'ticket.get',
                      args: { ticketId: 'tick_1001' },
                      reason: 'Need ticket context',
                    }),
                  },
                ],
              },
            },
          ],
        });
      },
    });

    const step = await provider.planNextStep({
      deployment: {
        name: 'demo',
        providers: { google: googleProvider() },
        connectors: {},
        agents: { supportTriage: { provider: 'google', instructions: './agent.md' } },
      },
      agentName: 'supportTriage',
      agent: { provider: 'google', instructions: './agent.md' },
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
    expect(calls[0].input).toBe('https://generativelanguage.test/v1beta/models/gemini-3.5-flash:generateContent');
    expect(calls[0].init?.headers).toMatchObject({
      'content-type': 'application/json',
      'x-goog-api-key': 'gemini-test',
    });
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      generationConfig: {
        maxOutputTokens: 800,
        responseMimeType: 'application/json',
        temperature: 1,
      },
    });
  });

  it('routes planner calls through an injected SDK client without an API key', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = {
      models: {
        async generateContent(params: Record<string, unknown>) {
          calls.push(params);
          return {
            candidates: [
              {
                content: {
                  parts: [
                    { text: JSON.stringify({ type: 'final', message: 'Resolved via SDK client' }) },
                  ],
                },
              },
            ],
          };
        },
      },
    };
    const config = googleProvider({ client });

    expect(config.env?.[0]).toMatchObject({ required: false });

    const provider = createGoogleProvider(config, {
      env: {},
      fetch: async () => {
        throw new Error('fetch should not be called when a client is injected');
      },
    });

    const step = await provider.planNextStep({
      deployment: {
        name: 'demo',
        providers: { google: config },
        connectors: {},
        agents: { supportTriage: { provider: 'google', instructions: './agent.md' } },
      },
      agentName: 'supportTriage',
      agent: { provider: 'google', instructions: './agent.md' },
      input: {},
      instructions: 'Classify tickets',
      toolResults: [],
      stepIndex: 0,
      maxSteps: 8,
    });

    expect(step).toEqual({ type: 'final', message: 'Resolved via SDK client' });
    expect(calls[0]).toMatchObject({ model: 'gemini-3.5-flash' });
  });

  it('requires a Google Gemini API key before making a request', async () => {
    const provider = createGoogleProvider(googleProvider({ apiKeyEnv: 'TEST_GEMINI_KEY' }), {
      env: {},
      fetch: async () => Response.json({}),
    });

    await expect(provider.planNextStep({
      deployment: {
        name: 'demo',
        providers: { google: googleProvider() },
        connectors: {},
        agents: { supportTriage: { provider: 'google', instructions: './agent.md' } },
      },
      agentName: 'supportTriage',
      agent: { provider: 'google', instructions: './agent.md' },
      input: {},
      instructions: 'Classify tickets',
      toolResults: [],
      stepIndex: 0,
      maxSteps: 8,
    })).rejects.toThrow('Missing Google Gemini API key');
  });
});
