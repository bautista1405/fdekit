import {
  asRecord,
  getNumber,
  getString,
  type DeploymentDefinition,
} from '@fdekit/core';
import type {
  BusinessImpactItem,
  ConnectorEvidence,
} from '../../interfaces/index.js';
import { recipeWorkflowName } from '../helpers.js';
import { isIssueTool } from '../trace-events.js';

export function createBusinessImpact(input: {
  deployment: DeploymentDefinition;
  traceCount: number;
  toolCallCount: number;
  externalActionCount: number;
  connectorEvidence: ConnectorEvidence[];
  evalCaseCount: number;
  evalPassedCases: number;
  evalStatus: string;
  reportReady: boolean;
  dashboardSnapshotReady: boolean;
}): BusinessImpactItem[] {
  const metadata = asRecord(input.deployment.metadata);
  const impactMetadata = asRecord(metadata.businessImpact);
  const evidenceSystems = [...new Set(input.connectorEvidence.map((item) => item.connector))].sort();
  const writeCount = input.externalActionCount;
  const writeEvidence = input.connectorEvidence.filter(
    (item) => isIssueTool(item.toolName) || item.toolName === 'slack.message',
  ).length;
  const contextReads = Math.max(input.connectorEvidence.length - writeEvidence, 0);
  const configuredMinutes = getNumber(impactMetadata.estimatedMinutesSaved);
  const workflowMetadata = asRecord(metadata.workflow);
  const workflowDefinition = asRecord(input.deployment.workflow);
  const workflow = getString(impactMetadata.workflow)
    ?? getString(workflowDefinition.name)
    ?? getString(workflowMetadata.name)
    ?? recipeWorkflowName(input.deployment);

  return [
    {
      label: 'Target workflow',
      value: workflow,
      detail: input.traceCount > 0
        ? `${input.traceCount} run(s) captured against this workflow`
        : 'No workflow execution evidence has been captured yet',
      status: input.traceCount > 0 ? 'pass' : 'warn',
    },
    {
      label: 'System actions',
      value: String(writeCount),
      detail: writeCount > 0
        ? `${writeCount} verified write(s); ${contextReads} context lookup(s)${evidenceSystems.length > 0 ? ` across ${evidenceSystems.join(', ')}` : ''}`
        : contextReads > 0
          ? `No writes yet; ${contextReads} context lookup(s) captured`
          : 'No customer-system action has been captured yet',
      status: writeCount > 0 ? 'pass' : 'warn',
    },
    configuredMinutes !== undefined
      ? {
        label: 'Time saved',
        value: `${Math.round(configuredMinutes)} min`,
        detail: 'From the configured manual baseline (estimatedMinutesSaved)',
        status: 'pass',
      }
      : {
        label: 'Steps automated',
        value: String(input.toolCallCount),
        detail: input.toolCallCount > 0
          ? 'Tool calls handled per review with no manual work'
          : 'No automated steps captured yet',
        status: input.toolCallCount > 0 ? 'pass' : 'warn',
      },
    {
      label: 'Validated quality',
      value: input.evalCaseCount > 0 ? `${input.evalPassedCases}/${input.evalCaseCount}` : 'not run',
      detail: validatedQualityDetail(input.evalStatus, input.reportReady, input.dashboardSnapshotReady),
      status: input.evalStatus === 'passed' && (input.reportReady || input.dashboardSnapshotReady)
        ? 'pass'
        : input.evalCaseCount > 0 && input.evalPassedCases < input.evalCaseCount
          ? 'fail'
          : 'warn',
    },
  ];
}

function validatedQualityDetail(evalStatus: string, reportReady: boolean, dashboardSnapshotReady: boolean): string {
  if (reportReady) {
    return `${evalStatus} eval status with a handoff report`;
  }

  if (dashboardSnapshotReady) {
    return `${evalStatus} eval status with a dashboard snapshot; deployment report missing`;
  }

  return `${evalStatus} eval status; deployment report and dashboard snapshot missing`;
}
