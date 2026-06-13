import type { DeploymentDefinition } from '@fdekit/core';
import type {
  ConnectorEvidence,
  IntegrationReadinessItem,
} from '../../interfaces/index.js';
import { normalizeName } from '../helpers.js';

export function createIntegrationReadiness(
  deployment: DeploymentDefinition,
  connectorEvidence: ConnectorEvidence[],
): IntegrationReadinessItem[] {
  const connectors = Object.entries(deployment.connectors ?? {});

  if (connectors.length === 0) {
    return [{
      label: 'Connectors',
      status: 'warn',
      detail: 'No customer systems configured yet',
    }];
  }

  return connectors.map(([key, connector]) => {
    const names = [key, connector.name].filter(Boolean).map(normalizeName);
    const evidenceCount = connectorEvidence.filter((item) => {
      const evidenceName = normalizeName(item.connector);
      return names.some((name) => evidenceName === name || evidenceName.includes(name) || name.includes(evidenceName));
    }).length;
    const toolCount = connector.tools?.length ?? 0;
    const requiredEnvCount = (connector.env ?? []).filter((requirement) => requirement.required !== false).length;
    const contractParts = [
      `${toolCount} tool(s)`,
      requiredEnvCount > 0 ? `${requiredEnvCount} required env var(s)` : 'no required env vars',
    ];

    return {
      label: connector.name,
      status: evidenceCount > 0 ? 'pass' : 'warn',
      detail: evidenceCount > 0
        ? `${evidenceCount} proven call(s); ${contractParts.join(', ')}`
        : `Configured but no trace evidence yet; ${contractParts.join(', ')}`,
    };
  });
}
