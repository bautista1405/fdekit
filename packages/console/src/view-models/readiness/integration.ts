import type { DeploymentDefinition } from '@fdekit/core';
import type {
  ConnectorEvidence,
  IntegrationReadinessItem,
} from '../../interfaces/index.js';
import { normalizeName } from '../helpers.js';
import { isProvenConnectorEvidence } from '../traces.js';

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
    const matchingEvidence = connectorEvidence.filter((item) => {
      const evidenceName = normalizeName(item.connector);
      return names.some((name) => evidenceName === name || evidenceName.includes(name) || name.includes(evidenceName));
    });
    const provenEvidenceCount = matchingEvidence.filter(isProvenConnectorEvidence).length;
    const failedMeasuredCount = matchingEvidence.filter((item) => (
      item.evidenceKind !== 'simulated' && item.status === 'failed'
    )).length;
    const simulatedEvidenceCount = matchingEvidence.filter((item) => item.evidenceKind === 'simulated').length;
    const toolCount = connector.tools?.length ?? 0;
    const requiredEnvCount = (connector.env ?? []).filter((requirement) => requirement.required !== false).length;
    const contractParts = [
      `${toolCount} tool(s)`,
      requiredEnvCount > 0 ? `${requiredEnvCount} required env var(s)` : 'no required env vars',
    ];

    return {
      label: connector.name,
      status: provenEvidenceCount > 0 ? 'pass' : 'warn',
      detail: provenEvidenceCount > 0
        ? `${provenEvidenceCount} successful measured call(s)${failedMeasuredCount > 0 ? `, ${failedMeasuredCount} failed measured call(s)` : ''}${simulatedEvidenceCount > 0 ? `, ${simulatedEvidenceCount} simulated call(s)` : ''}; ${contractParts.join(', ')}`
        : failedMeasuredCount > 0
          ? `${failedMeasuredCount} measured call(s) failed; no passing readiness evidence yet; ${contractParts.join(', ')}`
        : simulatedEvidenceCount > 0
          ? `${simulatedEvidenceCount} simulated call(s); local simulation is not measured readiness evidence; ${contractParts.join(', ')}`
        : `Configured but no trace evidence yet; ${contractParts.join(', ')}`,
    };
  });
}
