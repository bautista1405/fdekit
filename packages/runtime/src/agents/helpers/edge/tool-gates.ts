import type { AnyToolDefinition } from '@fdekit/core';
import { appendAudit } from '../audit.js';
import type { RunState } from '../types.js';
import { validateToolArgsSchema } from './schema.js';

interface ToolEdgeIssue {
  toolName: string;
  path: string;
  message: string;
}

export async function enforceToolCatalogEdge(state: RunState): Promise<void> {
  state.events.push({
    type: 'runtime.edge.profile',
    strict: state.edgeMode.strict,
    requireToolArgsSchema: state.edgeMode.requireToolArgsSchema,
    requireToolScopes: state.edgeMode.requireToolScopes,
    requireToolEnvironments: state.edgeMode.requireToolEnvironments,
    toolCount: state.tools.size,
  });

  if (!state.edgeMode.strict) {
    return;
  }

  const issues = [...state.tools.entries()].flatMap(([toolName, tool]) => (
    collectToolMetadataIssues(state, toolName, tool)
  ));

  if (issues.length === 0) {
    state.events.push({
      type: 'runtime.edge.catalog.validated',
      toolCount: state.tools.size,
    });
    await appendAudit(state, {
      action: 'runtime.edge.catalog.validated',
      outcome: 'allowed',
      metadata: { toolCount: state.tools.size },
    });
    return;
  }

  await blockEdge(state, {
    action: 'runtime.edge.catalog.blocked',
    policy: 'runtime-edge',
    issues,
  });
}

export async function enforceToolCallEdge(
  state: RunState,
  toolName: string,
  tool: AnyToolDefinition,
  args: Record<string, unknown>,
): Promise<void> {
  const metadataIssues = collectToolMetadataIssues(state, toolName, tool);

  if (metadataIssues.length > 0) {
    await blockEdge(state, {
      action: 'tool.edge.metadata.blocked',
      policy: 'runtime-edge',
      issues: metadataIssues,
    });
  }

  await enforceToolEnvironment(state, toolName, tool);
  await enforceToolArgsSchema(state, toolName, tool, args);
}

function collectToolMetadataIssues(
  state: RunState,
  toolName: string,
  tool: AnyToolDefinition,
): ToolEdgeIssue[] {
  const issues: ToolEdgeIssue[] = [];

  if (state.edgeMode.requireToolArgsSchema && !tool.argsSchema) {
    issues.push({
      toolName,
      path: 'argsSchema',
      message: `Tool "${toolName}" must declare argsSchema in strict mode`,
    });
  }

  if (state.edgeMode.requireToolScopes && (!tool.scopes || tool.scopes.length === 0)) {
    issues.push({
      toolName,
      path: 'scopes',
      message: `Tool "${toolName}" must declare permission scopes in strict mode`,
    });
  }

  if (state.edgeMode.requireToolEnvironments && (!tool.environments || tool.environments.length === 0)) {
    issues.push({
      toolName,
      path: 'environments',
      message: `Tool "${toolName}" must declare allowed environments in strict mode`,
    });
  }

  return issues;
}

async function enforceToolEnvironment(
  state: RunState,
  toolName: string,
  tool: AnyToolDefinition,
): Promise<void> {
  const allowedEnvironments = tool.environments ?? [];

  if (allowedEnvironments.length === 0) {
    return;
  }

  const environment = state.deployment.environment ?? 'local';

  if (allowedEnvironments.includes(environment)) {
    return;
  }

  await blockEdge(state, {
    action: 'tool.environment.blocked',
    policy: 'tool-environment',
    issues: [{
      toolName,
      path: 'environments',
      message: `Tool "${toolName}" is only enabled in: ${allowedEnvironments.join(', ')}; current environment: ${environment}`,
    }],
    metadata: {
      environment,
      allowedEnvironments,
      toolScopes: tool.scopes ?? [],
    },
  });
}

async function enforceToolArgsSchema(
  state: RunState,
  toolName: string,
  tool: AnyToolDefinition,
  args: Record<string, unknown>,
): Promise<void> {
  if (!tool.argsSchema) {
    return;
  }

  const issues = validateToolArgsSchema(tool.argsSchema, args).map((issue) => ({
    toolName,
    path: `argsSchema${issue.path.slice(1)}`,
    message: `Tool "${toolName}" args ${issue.path}: ${issue.message}`,
  }));

  if (issues.length === 0) {
    return;
  }

  await blockEdge(state, {
    action: 'tool.schema.blocked',
    policy: 'tool-schema',
    issues,
    metadata: {
      args,
      toolScopes: tool.scopes ?? [],
      toolAllowedEnvironments: tool.environments ?? [],
    },
  });
}

async function blockEdge(
  state: RunState,
  input: {
    action: string;
    policy: string;
    issues: ToolEdgeIssue[];
    metadata?: Record<string, unknown>;
  },
): Promise<never> {
  for (const issue of input.issues) {
    state.policyViolations.push({
      policy: input.policy,
      phase: 'beforeToolCall',
      toolName: issue.toolName,
      reason: issue.message,
    });
  }

  const reason = edgeReason(input.issues);
  state.events.push({
    type: input.action,
    policy: input.policy,
    reason,
    issues: input.issues,
  });
  await appendAudit(state, {
    action: input.action,
    outcome: 'blocked',
    policy: input.policy,
    toolName: input.issues[0]?.toolName,
    message: reason,
    metadata: {
      issues: input.issues,
      ...input.metadata,
    },
  });

  throw new Error(reason);
}

function edgeReason(issues: ToolEdgeIssue[]): string {
  const first = issues[0];
  const suffix = issues.length > 1 ? ` (${issues.length} edge issue(s) total)` : '';

  return first ? `${first.message}${suffix}` : 'Runtime edge blocked tool execution';
}
