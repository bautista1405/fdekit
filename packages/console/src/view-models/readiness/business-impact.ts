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
}): BusinessImpactItem[] {
  const metadata = asRecord(input.deployment.metadata);
  const impactMetadata = asRecord(metadata.businessImpact);
  const evidenceSystems = [...new Set(input.connectorEvidence.map((item) => item.connector))].sort();
  const actionCount = Math.max(input.externalActionCount, input.connectorEvidence.length);
  const estimatedMinutes = getNumber(impactMetadata.estimatedMinutesSaved)
    ?? (input.traceCount > 0 ? input.traceCount * 5 : Math.max(actionCount * 2, input.toolCallCount));
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
      value: String(actionCount),
      detail: evidenceSystems.length > 0
        ? `Evidence across ${evidenceSystems.join(', ')}`
        : 'No customer-system action has been captured yet',
      status: actionCount > 0 ? 'pass' : 'warn',
    },
    {
      label: 'Time-saving proxy',
      value: `${Math.round(estimatedMinutes)} min`,
      detail: 'Estimate from tool and handoff volume; replace with customer baseline during rollout',
      status: actionCount > 0 || input.toolCallCount > 0 ? 'pass' : 'warn',
    },
    {
      label: 'Validated quality',
      value: input.evalCaseCount > 0 ? `${input.evalPassedCases}/${input.evalCaseCount}` : 'not run',
      detail: input.reportReady
        ? `${input.evalStatus} eval status with a handoff report`
        : `${input.evalStatus} eval status; generate report before handoff`,
      status: input.evalStatus === 'passed' && input.reportReady ? 'pass' : input.evalCaseCount > 0 ? 'warn' : 'fail',
    },
  ];
}
