import type { HttpResilienceOptions } from '@fdekit/core';

/**
 * Minimal structural slice of the official `openai` SDK client.
 * Pass `new OpenAI()` (or any compatible object) to route planner calls
 * through the SDK's Responses API instead of FDEKit's raw HTTP path. The
 * injected client owns auth, retries, and timeouts.
 */
export interface OpenAIResponsesClient {
  responses: {
    create(params: Record<string, unknown>): Promise<unknown>;
  };
}

export interface OpenAIProviderOptions {
  model?: string;
  apiKeyEnv?: string;
  apiBaseUrl?: string;
  maxOutputTokens?: number;
  resilience?: HttpResilienceOptions;
  client?: OpenAIResponsesClient;
}

export interface OpenAIRuntimeOptions {
  fetch?: typeof globalThis.fetch;
  env?: Record<string, string | undefined>;
  resilience?: HttpResilienceOptions;
  client?: OpenAIResponsesClient;
}
