import { describe, expect, it } from 'vitest';
import { providerFromEnv } from '../index.js';

describe('providerFromEnv', () => {
  it('uses the credential-free mock provider by default', () => {
    expect(providerFromEnv({ env: {} })).toEqual({
      name: 'mock',
      model: undefined,
      env: [
        expect.objectContaining({
          name: 'FDEKIT_MODEL',
          required: false,
        }),
      ],
    });
  });

  it('builds only the provider selected through env', () => {
    expect(providerFromEnv({
      env: {
        FDEKIT_PROVIDER: 'openai',
        FDEKIT_MODEL: 'custom-model',
      },
    })).toEqual({
      name: 'openai',
      model: 'custom-model',
      apiKeyEnv: 'OPENAI_API_KEY',
      env: [
        expect.objectContaining({
          name: 'FDEKIT_MODEL',
          required: false,
        }),
      ],
    });

    expect(providerFromEnv({
      env: {
        FDEKIT_PROVIDER: 'localOllama',
        OLLAMA_BASE_URL: 'http://ollama.internal:11434',
      },
    })).toEqual({
      name: 'localOllama',
      model: undefined,
      env: expect.arrayContaining([
        expect.objectContaining({ name: 'FDEKIT_MODEL', required: false }),
        expect.objectContaining({ name: 'OLLAMA_BASE_URL', required: false }),
      ]),
      options: {
        apiBaseUrl: 'http://ollama.internal:11434',
      },
    });
  });

  it('rejects unsupported provider names instead of silently using mock', () => {
    expect(() => providerFromEnv({
      env: { FDEKIT_PROVIDER: 'mystery-provider' },
    })).toThrow('Unsupported FDEKIT_PROVIDER "mystery-provider"');
  });
});
