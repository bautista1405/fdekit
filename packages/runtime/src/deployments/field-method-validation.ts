import type { DeploymentDefinition } from '@fdekit/core';
import type { DeploymentValidationSeverity } from './interfaces/index.js';

type AddIssue = (
  severity: DeploymentValidationSeverity,
  path: string,
  message: string,
) => void;

export function validateFieldMethodMetadata(
  deployment: DeploymentDefinition,
  add: AddIssue,
): void {
  validateWorkflow(deployment.workflow, add);
  validateOutcomeMetrics(deployment.outcomeMetrics, add);
  validateDataLayers(deployment.dataLayers, add);
  validateRollout(deployment.rollout, add);
}

function validateWorkflow(value: unknown, add: AddIssue): void {
  if (value === undefined) {
    return;
  }

  const workflow = expectRecord(value, 'workflow', 'Workflow', add);

  if (!workflow) {
    return;
  }

  validateRequiredString(workflow.name, 'workflow.name', 'Workflow name', add);
  validateOptionalString(workflow.owner, 'workflow.owner', 'Workflow owner', add);
  validateOptionalString(workflow.description, 'workflow.description', 'Workflow description', add);
  validateWorkflowState(workflow.currentState, 'workflow.currentState', add);
  validateWorkflowState(workflow.targetState, 'workflow.targetState', add);
  validateWorkflowScorecard(workflow.scorecard, add);
  validateOptionalRecord(workflow.metadata, 'workflow.metadata', 'Workflow metadata', add);
}

function validateWorkflowState(value: unknown, path: string, add: AddIssue): void {
  if (value === undefined) {
    return;
  }

  const state = expectRecord(value, path, 'Workflow state', add);

  if (!state) {
    return;
  }

  validateOptionalString(state.summary, `${path}.summary`, 'Workflow state summary', add);
  validateOptionalStringArray(state.handoffs, `${path}.handoffs`, 'Workflow state handoffs', add);
  validateOptionalStringArray(state.evidence, `${path}.evidence`, 'Workflow state evidence', add);
  validateOptionalString(state.target, `${path}.target`, 'Workflow state target', add);
  validateOptionalRecord(state.metadata, `${path}.metadata`, 'Workflow state metadata', add);

  if (state.baseline === undefined) {
    return;
  }

  const baseline = expectRecord(state.baseline, `${path}.baseline`, 'Workflow baseline', add);

  if (!baseline) {
    return;
  }

  validateOptionalString(baseline.cycleTime, `${path}.baseline.cycleTime`, 'Workflow baseline cycleTime', add);
  validateOptionalString(baseline.cost, `${path}.baseline.cost`, 'Workflow baseline cost', add);
  validateOptionalString(baseline.errorRate, `${path}.baseline.errorRate`, 'Workflow baseline errorRate', add);

  if (
    baseline.manualSteps !== undefined
    && (typeof baseline.manualSteps !== 'number' || !Number.isFinite(baseline.manualSteps))
  ) {
    add('error', `${path}.baseline.manualSteps`, 'Workflow baseline manualSteps must be a finite number');
  }
}

function validateWorkflowScorecard(value: unknown, add: AddIssue): void {
  if (value === undefined) {
    return;
  }

  const scorecard = expectRecord(value, 'workflow.scorecard', 'Workflow scorecard', add);

  if (!scorecard) {
    return;
  }

  validateOptionalString(scorecard.volume, 'workflow.scorecard.volume', 'Workflow scorecard volume', add);
  validateOptionalString(scorecard.manualEffort, 'workflow.scorecard.manualEffort', 'Workflow scorecard manualEffort', add);
  validateOptionalString(
    scorecard.repeatableDecisions,
    'workflow.scorecard.repeatableDecisions',
    'Workflow scorecard repeatableDecisions',
    add,
  );
  validateOptionalStringArray(
    scorecard.fragmentedSystems,
    'workflow.scorecard.fragmentedSystems',
    'Workflow scorecard fragmentedSystems',
    add,
  );
  validateOptionalStringArray(
    scorecard.measurablePain,
    'workflow.scorecard.measurablePain',
    'Workflow scorecard measurablePain',
    add,
  );
  validateOptionalString(
    scorecard.riskBoundary,
    'workflow.scorecard.riskBoundary',
    'Workflow scorecard riskBoundary',
    add,
  );
  validateOptionalRecord(scorecard.metadata, 'workflow.scorecard.metadata', 'Workflow scorecard metadata', add);
}

function validateOutcomeMetrics(value: unknown, add: AddIssue): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    add('error', 'outcomeMetrics', 'Outcome metrics must be an array');
    return;
  }

  for (const [index, metricValue] of value.entries()) {
    const path = `outcomeMetrics.${index}`;
    const metric = expectRecord(metricValue, path, 'Outcome metric', add);

    if (!metric) {
      continue;
    }

    validateRequiredString(metric.name, `${path}.name`, 'Outcome metric name', add);

    for (const field of ['description', 'baseline', 'target', 'source', 'unit', 'owner'] as const) {
      validateOptionalString(
        metric[field],
        `${path}.${field}`,
        `Outcome metric ${field}`,
        add,
      );
    }

    validateOptionalRecord(metric.metadata, `${path}.metadata`, 'Outcome metric metadata', add);
  }
}

function validateDataLayers(value: unknown, add: AddIssue): void {
  if (value === undefined) {
    return;
  }

  const layers = expectRecord(value, 'dataLayers', 'Data layers', add);

  if (!layers) {
    return;
  }

  for (const field of ['systemOfRecord', 'businessRules', 'rawIntake', 'feedback'] as const) {
    validateOptionalStringArray(
      layers[field],
      `dataLayers.${field}`,
      `Data layers ${field}`,
      add,
    );
  }

  validateOptionalRecord(layers.metadata, 'dataLayers.metadata', 'Data layers metadata', add);
}

function validateRollout(value: unknown, add: AddIssue): void {
  if (value === undefined) {
    return;
  }

  const rollout = expectRecord(value, 'rollout', 'Rollout', add);

  if (!rollout) {
    return;
  }

  validateRequiredString(rollout.stage, 'rollout.stage', 'Rollout stage', add);
  validateOptionalStringArray(rollout.stages, 'rollout.stages', 'Rollout stages', add);
  validateOptionalString(rollout.next, 'rollout.next', 'Rollout next step', add);
  validateOptionalString(rollout.owner, 'rollout.owner', 'Rollout owner', add);
  validateOptionalRecord(rollout.metadata, 'rollout.metadata', 'Rollout metadata', add);
}

function validateRequiredString(
  value: unknown,
  path: string,
  label: string,
  add: AddIssue,
): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    add('error', path, `${label} must be a non-empty string`);
  }
}

function validateOptionalString(
  value: unknown,
  path: string,
  label: string,
  add: AddIssue,
): void {
  if (value !== undefined && typeof value !== 'string') {
    add('error', path, `${label} must be a string`);
  }
}

function validateOptionalStringArray(
  value: unknown,
  path: string,
  label: string,
  add: AddIssue,
): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    add('error', path, `${label} must be an array of strings`);
    return;
  }

  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string') {
      add('error', `${path}.${index}`, `${label} entries must be strings`);
    }
  }
}

function validateOptionalRecord(
  value: unknown,
  path: string,
  label: string,
  add: AddIssue,
): void {
  if (value !== undefined) {
    expectRecord(value, path, label, add);
  }
}

function expectRecord(
  value: unknown,
  path: string,
  label: string,
  add: AddIssue,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    add('error', path, `${label} must be an object`);
    return undefined;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
