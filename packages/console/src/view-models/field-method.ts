import {
  asRecord,
  getNumber,
  getString,
  isDefined,
  type DeploymentDefinition,
} from '@fdekit/core';
import type {
  FieldMethodItem,
  FieldMethodSummary,
  HarnessSummary,
} from '../interfaces/index.js';
import {
  recipeWorkflowName,
  stringArray,
  summarizeList,
} from './helpers.js';

export function collectHarness(deployment: DeploymentDefinition): HarnessSummary {
  const metadata = asRecord(deployment.metadata);
  const harness = {
    ...asRecord(metadata.harness),
    ...asRecord(deployment.harness),
  };
  const phases = Array.isArray(harness.phases) ? harness.phases : [];
  const artifactRefs = stringArray(harness.artifactRefs);
  const phaseItems = phases.map((phase, index) => harnessPhaseItem(phase, index));
  const references = harnessReferenceItems(harness);
  const name = getString(harness.name) ?? 'not configured';

  return {
    name,
    description: getString(harness.description)
      ?? (name === 'not configured'
        ? 'Add harness: defineHarness(...) to map phases to existing tools, policies, evals, and artifacts'
        : 'Agent phase and control sequence'),
    maxSteps: getNumber(harness.maxSteps)?.toString() ?? 'not configured',
    phaseCount: phaseItems.length,
    phases: phaseItems.length > 0
      ? phaseItems
      : [{
        label: 'Harness phases',
        value: 'not configured',
        detail: 'Define context, decision, action, and review phases to make the agent loop controllable',
        status: 'warn',
      }],
    references,
    artifactRefs,
    review: summarizeHarnessReview(harness.review),
    steer: summarizeHarnessSteer(harness.steer),
  };
}

export function collectFieldMethod(deployment: DeploymentDefinition): FieldMethodSummary {
  const metadata = asRecord(deployment.metadata);
  const legacyWorkflow = asRecord(metadata.workflow);
  const workflow = {
    ...legacyWorkflow,
    ...asRecord(deployment.workflow),
  };
  const currentState = asRecord(workflow.currentState);
  const currentBaseline = asRecord(currentState.baseline);
  const targetState = asRecord(workflow.targetState);
  const scorecard = {
    ...asRecord(metadata.scorecard),
    ...asRecord(workflow.scorecard),
  };
  const dataLayers = {
    ...asRecord(metadata.dataLayers),
    ...asRecord(deployment.dataLayers),
  };
  const rollout = {
    ...asRecord(metadata.rollout),
    ...asRecord(deployment.rollout),
  };
  const workflowName = getString(workflow.name) ?? recipeWorkflowName(deployment);
  const rolloutStage = getString(rollout.stage) ?? deployment.environment ?? 'local';

  return {
    workflowName,
    owner: getString(workflow.owner) ?? 'not assigned',
    currentState: getString(currentState.summary) ?? 'No current workflow summary configured',
    targetState: getString(targetState.summary) ?? 'No target workflow summary configured',
    baseline: getString(currentBaseline.cycleTime)
      ?? getString(workflow.baseline)
      ?? 'No baseline configured yet',
    target: getString(targetState.target)
      ?? getString(workflow.target)
      ?? 'No target metric configured yet',
    rolloutStage,
    rolloutNext: getString(rollout.next) ?? 'No rollout next step configured',
    scorecard: [
      fieldMethodItem('Volume', scorecard.volume, 'How often the workflow runs or how much value it touches'),
      fieldMethodItem('Manual effort', scorecard.manualEffort, 'How much human copying, searching, routing, or waiting exists'),
      fieldMethodItem('Fragmented systems', scorecard.fragmentedSystems, 'Systems the workflow must gather context from'),
      fieldMethodItem('Repeatable decisions', scorecard.repeatableDecisions, 'Whether the workflow follows patterns that can be evaluated'),
      fieldMethodItem('Measurable pain', scorecard.measurablePain, 'Cycle time, error rate, delayed revenue, approval lag, or similar baseline'),
      fieldMethodItem('Risk boundary', scorecard.riskBoundary, 'What remains human-owned or approval-gated'),
    ],
    dataLayers: [
      fieldMethodItem('System of record', dataLayers.systemOfRecord, 'Durable customer source of truth'),
      fieldMethodItem('Business rules', dataLayers.businessRules, 'Rules an operations owner should be able to review'),
      fieldMethodItem('Raw intake', dataLayers.rawIntake, 'Unprocessed input the agent reads or summarizes'),
      fieldMethodItem('Feedback and memory', dataLayers.feedback, 'Approvals, corrections, rejects, overrides, and future eval candidates'),
    ],
    outcomeMetrics: collectOutcomeMetrics(deployment.outcomeMetrics, workflow),
    rolloutStages: stringArray(rollout.stages),
  };
}

function harnessPhaseItem(phase: unknown, index: number): FieldMethodItem {
  const record = asRecord(phase);
  const toolRefs = stringArray(record.toolRefs);
  const optionalToolRefs = stringArray(record.optionalToolRefs);
  const policyRefs = stringArray(record.policyRefs);
  const evalRefs = stringArray(record.evalRefs);
  const artifactRefs = stringArray(record.artifactRefs);
  const maxSteps = getNumber(record.maxSteps);
  const controls = [
    toolRefs.length > 0 ? `tools: ${summarizeList(toolRefs, 3)}` : '',
    optionalToolRefs.length > 0 ? `optional tools: ${summarizeList(optionalToolRefs, 2)}` : '',
    policyRefs.length > 0 ? `policies: ${summarizeList(policyRefs, 3)}` : '',
    evalRefs.length > 0 ? `evals: ${summarizeList(evalRefs, 2)}` : '',
    artifactRefs.length > 0 ? `artifacts: ${summarizeList(artifactRefs, 3)}` : '',
    maxSteps ? `max ${maxSteps} step(s)` : '',
  ].filter(Boolean);

  return {
    label: getString(record.name) ?? `phase ${index + 1}`,
    value: controls.join('; ') || 'not configured',
    detail: getString(record.description)
      ?? getString(record.instructions)
      ?? 'No phase description configured',
    status: controls.length > 0 ? 'declared' : 'warn',
  };
}

function harnessReferenceItems(harness: Record<string, unknown>): FieldMethodItem[] {
  return [
    ...referenceItems('Tool', stringArray(harness.toolRefs), 'Tool referenced by one or more harness phases'),
    ...referenceItems('Policy', stringArray(harness.policyRefs), 'Policy enforced outside the harness'),
    ...referenceItems('Eval', stringArray(harness.evalRefs), 'Eval suite used to verify the harnessed workflow'),
    ...referenceItems('Artifact', stringArray(harness.artifactRefs), 'Artifact produced by runtime, eval, report, or console commands'),
  ];
}

function referenceItems(kind: string, refs: string[], detail: string): FieldMethodItem[] {
  return refs.map((ref) => ({
    label: ref,
    value: kind,
    detail,
    status: 'declared',
  }));
}

function summarizeHarnessReview(value: unknown): string {
  const review = asRecord(value);
  const evalRefs = stringArray(review.evalRefs);
  const artifactRefs = stringArray(review.artifactRefs);

  if (Object.keys(review).length === 0) {
    return 'not configured';
  }

  return [
    'configured',
    evalRefs.length > 0 ? `evals: ${summarizeList(evalRefs, 2)}` : '',
    artifactRefs.length > 0 ? `artifacts: ${summarizeList(artifactRefs, 2)}` : '',
  ].filter(Boolean).join('; ');
}

function summarizeHarnessSteer(value: unknown): string {
  const steer = asRecord(value);
  const triggers = stringArray(steer.triggerRefs);
  const maxAttempts = getNumber(steer.maxAttempts);

  if (Object.keys(steer).length === 0) {
    return 'not configured';
  }

  if (steer.enabled === false) {
    return 'disabled';
  }

  return [
    'enabled',
    maxAttempts ? `${maxAttempts} attempt(s)` : '',
    triggers.length > 0 ? `on ${summarizeList(triggers, 3)}` : '',
  ].filter(Boolean).join('; ');
}

function collectOutcomeMetrics(
  outcomeMetrics: unknown,
  workflow: Record<string, unknown>,
): FieldMethodItem[] {
  const metrics = Array.isArray(outcomeMetrics) && outcomeMetrics.length > 0
    ? outcomeMetrics
    : Array.isArray(workflow.outcomeMetrics)
      ? workflow.outcomeMetrics
      : [];

  if (metrics.length === 0) {
    return [
      {
        label: 'Outcome metric',
        value: 'not configured',
        detail: 'Add outcomeMetrics to make business impact measurable',
        status: 'warn',
      },
    ];
  }

  return metrics
    .map((metric, index) => {
      const record = asRecord(metric);
      const name = getString(record.name) ?? `metric ${index + 1}`;
      const baseline = getString(record.baseline) ?? 'baseline not configured';
      const target = getString(record.target) ?? 'target not configured';

      return {
        label: name,
        value: target,
        detail: target === 'target not configured'
          ? `Baseline: ${baseline}`
          : `Baseline: ${baseline}; measurement not captured yet`,
        status: target === 'target not configured' ? 'warn' : 'not measured',
      } satisfies FieldMethodItem;
    });
}

function fieldMethodItem(label: string, value: unknown, fallbackDetail: string): FieldMethodItem {
  const values = fieldMethodValues(value);
  const rendered = values.length > 0 ? values.join(', ') : 'not configured';

  return {
    label,
    value: rendered,
    detail: fallbackDetail,
    status: values.length === 0 || rendered === 'unknown' ? 'warn' : 'declared',
  };
}

function fieldMethodValues(value: unknown): string[] {
  if (typeof value === 'string' && value.length > 0) {
    return [value];
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => typeof item === 'string' ? item : typeof item === 'number' && Number.isFinite(item) ? String(item) : undefined)
      .filter(isDefined);
  }

  return [];
}
