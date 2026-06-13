import type {
  AgentConfig,
  AnyToolDefinition,
  DeploymentDefinition,
  ToolCallContext,
} from '@fdekit/core';
import { redactForGovernance } from '../../governance/index.js';
import { appendAudit } from './audit.js';
import { enforceToolCallEdge } from './edge/index.js';
import { enforcePolicies } from './policy-enforcement.js';
import type { RunState } from './types.js';

export async function callTool(
  state: RunState,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = state.tools.get(toolName);

  if (!tool) {
    throw new Error(`Tool "${toolName}" is not available to agent "${state.agentName}"`);
  }

  await enforceToolCallEdge(state, toolName, tool, args);

  const context = createToolContext(state, toolName, tool);
  await enforcePolicies(state, 'beforeToolCall', toolName, args, context);

  const startedAt = Date.now();
  const redactedArgs = redactForGovernance(args);
  state.events.push({
    type: 'tool.call.started',
    toolName,
    args: redactedArgs,
    toolScopes: tool.scopes ?? [],
    toolAllowedEnvironments: tool.environments ?? [],
    toolCategory: tool.category,
    toolTags: tool.tags ?? [],
  });
  await appendAudit(state, {
    action: 'tool.call.started',
    outcome: 'requested',
    toolName,
    metadata: {
      args: redactedArgs,
      toolScopes: tool.scopes ?? [],
      toolAllowedEnvironments: tool.environments ?? [],
      toolCategory: tool.category,
      toolTags: tool.tags ?? [],
    },
  });

  const result = await tool.handler(args, context);
  const latencyMs = Date.now() - startedAt;

  await enforcePolicies(state, 'afterToolCall', toolName, result, createToolContext(state, toolName, tool));
  const redactedResult = redactForGovernance(result);

  const call = {
    name: toolName,
    args: redactedArgs,
    result: redactedResult,
    latencyMs,
    category: tool.category,
    tags: [...(tool.tags ?? [])],
    scopes: [...(tool.scopes ?? [])],
    environments: [...(tool.environments ?? [])],
  };

  state.toolCalls.push(call);
  state.events.push({
    type: 'tool.call.completed',
    toolName,
    args: redactedArgs,
    result: redactedResult,
    latencyMs,
    toolScopes: tool.scopes ?? [],
    toolAllowedEnvironments: tool.environments ?? [],
    toolCategory: tool.category,
    toolTags: tool.tags ?? [],
  });
  await appendAudit(state, {
    action: 'tool.call.completed',
    outcome: 'succeeded',
    toolName,
    metadata: {
      latencyMs,
      args: redactedArgs,
      result: redactedResult,
      toolScopes: tool.scopes ?? [],
      toolAllowedEnvironments: tool.environments ?? [],
      toolCategory: tool.category,
      toolTags: tool.tags ?? [],
    },
  });

  return result;
}

export function collectAgentTools(deployment: DeploymentDefinition, agent: AgentConfig): Map<string, AnyToolDefinition> {
  const tools = new Map<string, AnyToolDefinition>();

  for (const connector of Object.values(deployment.connectors ?? {})) {
    for (const tool of connector.tools ?? []) {
      tools.set(tool.name, tool);
    }
  }

  for (const tool of agent.tools ?? []) {
    tools.set(tool.name, tool);
  }

  return tools;
}

function createToolContext(
  state: RunState,
  toolName: string,
  tool: AnyToolDefinition,
): ToolCallContext {
  return {
    deploymentName: state.deployment.name,
    agentName: state.agentName,
    environment: state.deployment.environment,
    runtimeEnvironment: state.deployment.runtimeEnvironment,
    toolName,
    toolScopes: tool.scopes ?? [],
    toolAllowedEnvironments: tool.environments ?? [],
    toolCategory: tool.category,
    toolTags: tool.tags ?? [],
    toolCallCount: state.toolCalls.length,
    costUsd: state.costUsd,
    metadata: {
      input: state.input,
    },
  };
}
