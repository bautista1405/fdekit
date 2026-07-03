import type { AnyToolDefinition } from './tool.js';
import type { ConnectorName, EnvironmentVariableRequirement, MaybePromise } from './shared.js';

export interface ConnectorReadinessCheck {
  /** Sub-check identifier, e.g. `tree-sitter`, `ripgrep`, `symbol-index`. */
  name: string;
  /** False marks an environment problem that `fdekit doctor` reports as a warning. */
  ok: boolean;
  message: string;
  latencyMs?: number;
}

export interface ConnectorDefinition<Config = Record<string, unknown>> {
  name: ConnectorName;
  description?: string;
  config?: Config;
  env?: EnvironmentVariableRequirement[];
  tools?: AnyToolDefinition[];
  /**
   * Optional operator-facing environment probe surfaced by `fdekit doctor`.
   * Reports whether the connector's runtime prerequisites are healthy (native
   * binaries, parsers, caches). Distinct from agent-invocable `*.healthCheck`
   * tools: readiness is diagnostics, not a capability the agent can call.
   */
  readiness?: () => MaybePromise<ConnectorReadinessCheck[]>;
}
