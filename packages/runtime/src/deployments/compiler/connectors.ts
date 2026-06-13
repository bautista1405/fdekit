import type { AnyToolDefinition, ConnectorDefinition } from '@fdekit/core';
import type { CompiledConnectorPlan, CompiledToolPlan } from '../interfaces/index.js';
import { compareByName, envNames, sortedEntries } from './shared.js';

export function compileConnectors(connectors: Record<string, ConnectorDefinition>): Record<string, CompiledConnectorPlan> {
  return Object.fromEntries(sortedEntries(connectors).map(([key, connector]) => [
    key,
    {
      key,
      name: connector.name,
      env: envNames(connector.env),
      configKeys: Object.keys(connector.config ?? {}).sort(),
      tools: (connector.tools ?? [])
        .map((tool) => compileTool(tool, 'connector', `connectors.${key}`))
        .sort(compareByName),
    },
  ]));
}

export function compileTool(
  tool: AnyToolDefinition,
  source: 'connector' | 'agent',
  owner: string,
): CompiledToolPlan {
  return {
    name: tool.name,
    source,
    owner,
    description: tool.description,
    category: tool.category,
    tags: [...(tool.tags ?? [])].sort(),
    scopes: [...(tool.scopes ?? [])].sort(),
    environments: [...(tool.environments ?? [])].sort(),
    hasArgsSchema: Boolean(tool.argsSchema),
  };
}
