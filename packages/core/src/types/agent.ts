import type { EvalDefinition } from './eval.js';
import type { GovernanceDefinition } from './governance.js';
import type { HarnessDefinition } from './harness.js';
import type { PolicyDefinition } from './policy.js';
import type { AnyToolDefinition } from './tool.js';

export interface AgentConfig {
  instructions: string;
  provider?: string;
  model?: string;
  tools?: AnyToolDefinition[];
  harness?: HarnessDefinition;
  governance?: GovernanceDefinition;
  policies?: PolicyDefinition[];
  evals?: EvalDefinition[];
  metadata?: Record<string, unknown>;
}
