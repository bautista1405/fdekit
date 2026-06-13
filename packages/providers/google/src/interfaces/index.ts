import type { HttpResilienceOptions } from '@fdekit/core';

/**
 * Minimal structural slice of the official `@google/genai` SDK client.
 * Pass `new GoogleGenAI()` (or any compatible object) to route planner calls
 * through the SDK instead of FDEKit's raw HTTP path. The injected client owns
 * auth, retries, and timeouts.
 */
export interface GoogleGenAIClient {
  models: {
    generateContent(params: Record<string, unknown>): Promise<unknown>;
  };
}

export interface GoogleProviderOptions {
  model?: string;
  apiKeyEnv?: string;
  apiBaseUrl?: string;
  maxOutputTokens?: number;
  temperature?: number;
  responseMimeType?: string;
  resilience?: HttpResilienceOptions;
  client?: GoogleGenAIClient;
}

export interface GoogleRuntimeOptions {
  fetch?: typeof globalThis.fetch;
  env?: Record<string, string | undefined>;
  resilience?: HttpResilienceOptions;
  client?: GoogleGenAIClient;
}
