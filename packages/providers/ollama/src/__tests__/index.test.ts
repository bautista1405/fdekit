import { describe, expect, it } from 'vitest';
import { createOllamaProvider, localOllamaProvider, ollamaProvider } from '../index.js';

describe('ollamaProvider', () => {
  it('declares optional local Ollama env settings', () => {
    const provider = localOllamaProvider({ model: 'qwen2.5:7b', apiBaseUrl: 'http://localhost:11434/' });

    expect(provider).toMatchObject({
      name: 'localOllama',
      model: 'qwen2.5:7b',
    });
    expect(provider.options).toMatchObject({
      apiBaseUrl: 'http://localhost:11434/',
      format: 'json',
      numPredict: 800,
      temperature: 0,
    });
    expect(provider.env).toEqual([
      expect.objectContaining({ name: 'OLLAMA_BASE_URL', required: false }),
      expect.objectContaining({ name: 'FDEKIT_MODEL', required: false }),
    ]);
    expect(provider.apiKeyEnv).toBeUndefined();
  });

  it('plans a tool call through the Ollama chat API', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const provider = createOllamaProvider(ollamaProvider({
      model: 'llama3.1:8b',
      apiBaseUrl: 'http://ollama.test/',
      numPredict: 400,
      temperature: 0.2,
    }), {
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({
          message: {
            role: 'assistant',
            content: JSON.stringify({
              type: 'tool_call',
              toolName: 'codebase.search',
              args: { query: 'TODO(fdekit)' },
              reason: 'Need codebase evidence',
            }),
          },
        });
      },
    });

    const step = await provider.planNextStep({
      deployment: {
        name: 'demo',
        providers: { ollama: ollamaProvider() },
        connectors: {},
        agents: { codebaseAgent: { provider: 'ollama', instructions: './agent.md' } },
      },
      agentName: 'codebaseAgent',
      agent: { provider: 'ollama', instructions: './agent.md' },
      input: { query: 'TODO(fdekit)' },
      instructions: 'Review the repository',
      toolResults: [],
      stepIndex: 0,
      maxSteps: 8,
    });

    expect(step).toEqual({
      type: 'tool_call',
      toolName: 'codebase.search',
      args: { query: 'TODO(fdekit)' },
      reason: 'Need codebase evidence',
    });
    expect(calls[0].input).toBe('http://ollama.test/api/chat');
    expect(calls[0].init?.headers).toMatchObject({
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      model: 'llama3.1:8b',
      stream: false,
      format: 'json',
      keep_alive: '5m',
      options: {
        num_predict: 400,
        temperature: 0.2,
      },
    });
  });

  it('plans a final step from Ollama response text', async () => {
    const provider = createOllamaProvider(localOllamaProvider(), {
      fetch: async () => Response.json({
        response: JSON.stringify({
          type: 'final',
          message: 'Local review complete',
        }),
      }),
    });

    await expect(provider.planNextStep({
      deployment: {
        name: 'demo',
        providers: { localOllama: localOllamaProvider() },
        connectors: {},
        agents: { supportTriage: { provider: 'localOllama', instructions: './agent.md' } },
      },
      agentName: 'supportTriage',
      agent: { provider: 'localOllama', instructions: './agent.md' },
      input: {},
      instructions: 'Classify tickets',
      toolResults: [],
      stepIndex: 1,
      maxSteps: 8,
    })).resolves.toEqual({
      type: 'final',
      message: 'Local review complete',
    });
  });
});
