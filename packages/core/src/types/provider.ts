import type { AgentConfig } from './agent.js';
import type { DeploymentDefinition } from './deployment.js';
import type { EnvironmentVariableRequirement, MaybePromise, ProviderName } from './shared.js';

export interface ProviderConfig {
  name: ProviderName;
  model?: string;
  apiKeyEnv?: string;
  env?: EnvironmentVariableRequirement[];
  runtime?: ProviderRuntimeAdapter;
  options?: Record<string, unknown>;
}

export interface ProviderToolResult {
  name: string;
  args: unknown;
  result?: unknown;
  latencyMs: number;
  is_error?: boolean;
}

export interface ProviderPlanContext {
  deployment: DeploymentDefinition;
  agentName: string;
  agent: AgentConfig;
  input: Record<string, unknown>;
  instructions: string;
  toolResults: ProviderToolResult[];
  stepIndex: number;
  maxSteps: number;
}

export type ProviderStep = ProviderToolCallStep | ProviderFinalStep;

export interface ProviderToolCallStep {
  type: 'tool_call';
  toolName: string;
  args: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderFinalStep {
  type: 'final';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AgentProvider {
  name: string;
  planNextStep: (context: ProviderPlanContext) => MaybePromise<ProviderStep>;
}

export type ProviderRuntimeFactory = (config: ProviderConfig) => MaybePromise<AgentProvider>;
export type ProviderRuntimeAdapter = AgentProvider | ProviderRuntimeFactory;
export type ProviderRuntimeRegistry = Record<string, ProviderRuntimeAdapter>;

export interface RetryPolicy {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
  retryStatusCodes?: number[];
  /** Upper bound applied to server-provided Retry-After waits; 0 disables honoring the header. */
  maxRetryAfterMs?: number;
}

export interface CircuitBreakerPolicy {
  failureThreshold?: number;
  resetTimeoutMs?: number;
}

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failureCount: number;
  openedAt?: number;
}

export interface HttpResilienceOptions {
  retry?: boolean | RetryPolicy;
  circuitBreaker?: boolean | CircuitBreakerPolicy;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  operationName?: string;
}

export interface HttpResilienceClient {
  request: (fetchImpl: typeof globalThis.fetch, input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  getCircuitState: () => CircuitBreakerState;
}
