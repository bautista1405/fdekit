import type { DeploymentDefinition } from '@fdekit/core';

export interface RuntimeEdgeOptions {
  strict?: boolean;
  requireToolArgsSchema?: boolean;
}

export interface RuntimeEdgeMode {
  strict: boolean;
  requireToolArgsSchema: boolean;
  requireToolScopes: boolean;
  requireToolEnvironments: boolean;
}

export function resolveRuntimeEdgeMode(
  _deployment: DeploymentDefinition,
  options: RuntimeEdgeOptions = {},
): RuntimeEdgeMode {
  const strict = options.strict === true;

  return {
    strict,
    requireToolArgsSchema: options.requireToolArgsSchema ?? strict,
    requireToolScopes: strict,
    requireToolEnvironments: strict,
  };
}
