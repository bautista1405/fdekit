import type { AnyToolDefinition, DeploymentDefinition } from '@fdekit/core';

export const TOOL_SEMANTICS = {
  escalation: 'escalation',
  crmHandoff: 'crm-handoff',
} as const;

export interface ToolMetadata {
  name: string;
  category?: string;
  tags: string[];
  scopes: string[];
  environments: string[];
}

export type ToolMetadataIndex = Map<string, ToolMetadata>;

export function buildToolMetadataIndex(deployment: DeploymentDefinition): ToolMetadataIndex {
  const index: ToolMetadataIndex = new Map();

  for (const connector of Object.values(deployment.connectors ?? {})) {
    for (const tool of connector.tools ?? []) {
      index.set(tool.name, toolMetadataFromDefinition(tool));
    }
  }

  for (const agent of Object.values(deployment.agents ?? {})) {
    for (const tool of agent.tools ?? []) {
      index.set(tool.name, toolMetadataFromDefinition(tool));
    }
  }

  return index;
}

export function indexToolMetadata(tools: Iterable<ToolMetadata>): ToolMetadataIndex {
  return mergeToolMetadataIndexes(new Map([...tools].map((tool) => [tool.name, tool])));
}

export function mergeToolMetadataIndexes(...indexes: ToolMetadataIndex[]): ToolMetadataIndex {
  const merged: ToolMetadataIndex = new Map();

  for (const index of indexes) {
    for (const [name, tool] of index) {
      const current = merged.get(name);
      merged.set(name, current ? mergeToolMetadata(current, tool) : normalizeToolMetadata(tool));
    }
  }

  return merged;
}

export function toolMetadataFromDefinition(tool: AnyToolDefinition): ToolMetadata {
  return normalizeToolMetadata({
    name: tool.name,
    category: tool.category,
    tags: tool.tags ?? [],
    scopes: tool.scopes ?? [],
    environments: tool.environments ?? [],
  });
}

export function toolNamesWithSemantic(index: ToolMetadataIndex, semantic: string): string[] {
  return [...index.values()]
    .filter((tool) => toolMatchesSemantic(tool, semantic))
    .map((tool) => tool.name)
    .sort();
}

export function toolCallsWithSemantic(
  toolCalls: readonly string[],
  index: ToolMetadataIndex | undefined,
  semantic: string,
): string[] {
  if (!index) {
    return [];
  }

  const matches = new Set<string>();

  for (const toolName of toolCalls) {
    const tool = index.get(toolName);

    if (tool && toolMatchesSemantic(tool, semantic)) {
      matches.add(toolName);
    }
  }

  return [...matches].sort();
}

export function toolMatchesSemantic(tool: ToolMetadata, semantic: string): boolean {
  const normalized = normalizeText(semantic);
  return normalizeText(tool.category) === normalized
    || tool.tags.some((tag) => normalizeText(tag) === normalized);
}

function mergeToolMetadata(left: ToolMetadata, right: ToolMetadata): ToolMetadata {
  return normalizeToolMetadata({
    name: right.name || left.name,
    category: right.category ?? left.category,
    tags: [...left.tags, ...right.tags],
    scopes: [...left.scopes, ...right.scopes],
    environments: [...left.environments, ...right.environments],
  });
}

function normalizeToolMetadata(tool: ToolMetadata): ToolMetadata {
  return {
    name: tool.name,
    category: normalizeOptionalText(tool.category),
    tags: uniqueList(tool.tags),
    scopes: uniqueList(tool.scopes),
    environments: uniqueList(tool.environments),
  };
}

function uniqueList(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}
