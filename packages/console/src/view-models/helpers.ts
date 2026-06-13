import type { DeploymentDefinition } from '@fdekit/core';
import { isIssueTool } from './trace-events.js';

export function recipeWorkflowName(deployment: DeploymentDefinition): string {
  const recipeName = deployment.recipe?.name ?? deployment.name;

  return recipeName
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function summarizeList(values: string[], maxItems: number): string {
  const visible = values.slice(0, maxItems);
  const remaining = values.length - visible.length;

  return remaining > 0
    ? `${visible.join(', ')} +${remaining} more`
    : visible.join(', ');
}

export function isContextTool(toolName: string): boolean {
  return toolName.startsWith('codebase.')
    || toolName.startsWith('postgres.')
    || toolName.startsWith('sales.')
    || toolName.startsWith('hubspot.')
    || toolName.startsWith('salesforce.')
    || toolName.includes('.lookup')
    || toolName.includes('.find')
    || toolName.includes('.read')
    || toolName.includes('.get')
    || toolName === 'customer.get'
    || toolName === 'ticket.get';
}

export function isActionTool(toolName: string): boolean {
  return isIssueTool(toolName)
    || toolName === 'slack.message'
    || toolName === 'ticket.escalate'
    || toolName.endsWith('.create')
    || toolName.endsWith('.update')
    || toolName.endsWith('.send')
    || toolName.endsWith('.message');
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
