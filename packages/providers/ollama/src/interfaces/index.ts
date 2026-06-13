import type { HttpResilienceOptions } from '@fdekit/core';

export interface OllamaProviderOptions {
  model?: string;
  apiBaseUrl?: string;
  format?: 'json' | Record<string, unknown>;
  keepAlive?: string | number;
  numPredict?: number;
  temperature?: number;
  resilience?: HttpResilienceOptions;
}

export interface OllamaRuntimeOptions {
  fetch?: typeof globalThis.fetch;
  resilience?: HttpResilienceOptions;
}
