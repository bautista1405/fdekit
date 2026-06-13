import type { MaybePromise } from './shared.js';
import type { ToolCallContext } from './tool.js';

export interface PolicyDecision<Value = unknown> {
  allowed: boolean;
  reason?: string;
  approvalRequired?: boolean;
  value?: Value;
  metadata?: Record<string, unknown>;
}

export type PolicyResult<Value = unknown> = boolean | PolicyDecision<Value>;

export interface PolicyDefinition {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  beforeToolCall?: (
    toolName: string,
    args: unknown,
    context: ToolCallContext,
  ) => MaybePromise<PolicyResult>;
  afterToolCall?: (
    toolName: string,
    result: unknown,
    context: ToolCallContext,
  ) => MaybePromise<PolicyResult>;
}
