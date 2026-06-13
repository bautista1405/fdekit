import type { DeploymentDefinition } from '@fdekit/core';
import type {
  ConnectorEvidence,
  ConsoleHistoryEntry,
  ReusablePatternItem,
} from '../../interfaces/index.js';

export function createReusablePatterns(input: {
  deployment: DeploymentDefinition;
  connectorEvidence: ConnectorEvidence[];
  history: ConsoleHistoryEntry[];
}): ReusablePatternItem[] {
  const connectorToolCount = Object.values(input.deployment.connectors ?? {})
    .reduce((total, connector) => total + (connector.tools?.length ?? 0), 0);
  const agentToolCount = Object.values(input.deployment.agents ?? {})
    .reduce((total, agent) => total + (agent.tools?.length ?? 0), 0);
  const customToolCount = connectorToolCount + agentToolCount;
  const recipe = input.deployment.recipe;
  const migrationCount = input.deployment.migrationNotes?.length ?? 0;
  const evidenceSystems = [...new Set(input.connectorEvidence.map((item) => item.connector))].sort();

  return [
    {
      label: 'Base recipe',
      value: recipe ? `${recipe.name}@${recipe.version ?? 'unversioned'}` : 'custom',
      detail: recipe ? 'Deployment keeps a recipe identity for reuse and upgrades' : 'No recipe reference captured',
      status: recipe ? 'pass' : 'warn',
    },
    {
      label: 'Deployment version',
      value: input.deployment.version ?? 'unversioned',
      detail: 'Versioned deployments make customer upgrades and diffs easier to explain',
      status: input.deployment.version ? 'pass' : 'warn',
    },
    {
      label: 'Custom surface',
      value: `${customToolCount} tool(s)`,
      detail: evidenceSystems.length > 0
        ? `Evidence from ${evidenceSystems.join(', ')} can become reusable modules`
        : 'Add customer-specific tools to package reusable patterns',
      status: customToolCount > 0 || evidenceSystems.length > 0 ? 'pass' : 'warn',
    },
    {
      label: 'Migration notes',
      value: String(migrationCount),
      detail: migrationCount > 0
        ? 'Human-readable upgrade notes are attached to this deployment'
        : 'Add migration notes before publishing a recipe update',
      status: migrationCount > 0 ? 'pass' : 'warn',
    },
    {
      label: 'History',
      value: String(input.history.length),
      detail: 'Preserved snapshots show how the deployment evolved across runs',
      status: input.history.length > 0 ? 'pass' : 'warn',
    },
  ];
}
