import type { HttpResilienceOptions } from '@fdekit/core';

/**
 * Minimal structural slice of the official `@anthropic-ai/sdk` client.
 * Pass `new Anthropic()` (or any compatible object) to route planner calls
 * through the SDK instead of FDEKit's raw HTTP path. The injected client owns
 * auth, retries, and timeouts.
 */
export interface AnthropicMessagesClient {
  messages: {
    create(params: Record<string, unknown>): Promise<unknown>;
  };
}

export interface AnthropicProviderOptions {
  model?: string;
  apiKeyEnv?: string;
  apiBaseUrl?: string;
  anthropicVersion?: string;
  maxTokens?: number;
  resilience?: HttpResilienceOptions;
  client?: AnthropicMessagesClient;
}

export interface AnthropicRuntimeOptions {
  fetch?: typeof globalThis.fetch;
  env?: Record<string, string | undefined>;
  resilience?: HttpResilienceOptions;
  client?: AnthropicMessagesClient;
}
