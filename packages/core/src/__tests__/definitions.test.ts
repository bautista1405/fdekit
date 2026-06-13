import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  defineAgent,
  defineDataLayers,
  defineDeployment,
  defineEnvironment,
  defineEval,
  defineHarness,
  defineOutcomeMetric,
  defineRollout,
  defineTool,
  defineWorkflow,
  environmentEndpoint,
  environmentEndpointConfigValue,
  expectedToolCall,
  isEnvironmentEndpointRef,
  limitCost,
  parseEnvironmentEndpointConfigValue,
  requireApproval,
  resolveEnvironmentEndpoint,
} from '../index.js';

describe('definition helpers', () => {
  it('defines field deployment method primitives as typed deployment fields', () => {
    const workflow = defineWorkflow({
      name: 'Support escalation',
      owner: 'support ops',
      currentState: {
        summary: 'Agents manually inspect tickets, customer records, and escalation rules',
        baseline: {
          cycleTime: '18 minutes',
          manualSteps: 7,
        },
      },
      targetState: {
        summary: 'The agent gathers context and drafts a governed escalation',
        target: 'under 5 minutes',
      },
      scorecard: {
        volume: 'high',
        manualEffort: 'high',
        fragmentedSystems: ['Slack', 'Postgres', 'GitHub'],
        repeatableDecisions: 'medium',
        measurablePain: ['cycle time', 'handoff delay'],
        riskBoundary: 'Human approval required before external writes',
      },
    });
    const outcomeMetric = defineOutcomeMetric({
      name: 'Escalation cycle time',
      baseline: '18 minutes',
      target: 'under 5 minutes',
      source: 'support queue',
    });
    const dataLayers = defineDataLayers({
      systemOfRecord: ['Postgres customer profile'],
      businessRules: ['support escalation policy'],
      rawIntake: ['ticket text'],
      feedback: ['approvals and corrections'],
    });
    const rollout = defineRollout({
      stage: 'shadow',
      stages: ['local', 'shadow', 'approved-write'],
      next: 'Move five low-risk tickets into approved-write mode',
    });
    const ticketTool = defineTool({
      name: 'ticket.get',
      handler() {
        return null;
      },
    });
    const costPolicy = limitCost({ maxUsd: 0.25 });
    const approvalPolicy = requireApproval({ tools: ['issue.create', 'slack.message'] });
    const supportEval = defineEval({
      name: 'support-triage-dataset',
      assertions: [expectedToolCall('ticket.get')],
    });
    const harness = defineHarness({
      name: 'support-triage-governed-loop',
      maxSteps: 8,
      phases: [
        {
          name: 'context',
          toolRefs: [ticketTool, 'customer.get'],
          artifactRefs: ['trace'],
        },
        {
          name: 'decision',
          policyRefs: [costPolicy],
          evalRefs: [supportEval],
        },
        {
          name: 'action',
          toolRefs: ['issue.create', 'slack.message'],
          policyRefs: [approvalPolicy],
          artifactRefs: ['approval', 'audit'],
        },
        {
          name: 'review',
          evalRefs: [supportEval],
          artifactRefs: ['eval', 'report', 'dashboard'],
        },
      ],
      toolRefs: [ticketTool, 'customer.get', 'issue.create', 'slack.message'],
      policyRefs: ['deny-pii-leak', costPolicy, approvalPolicy],
      evalRefs: [supportEval],
      artifactRefs: ['trace', 'approval', 'audit', 'eval', 'report', 'dashboard'],
      review: {
        evalRefs: [supportEval],
        artifactRefs: ['report', 'dashboard'],
      },
    });
    const deployment = defineDeployment({
      name: 'support-triage',
      providers: {
        mock: { name: 'mock' },
      },
      agents: {
        triage: defineAgent({
          provider: 'mock',
          instructions: './agents/support-triage.md',
          tools: [ticketTool],
        }),
      },
      policies: [costPolicy, approvalPolicy],
      evals: [supportEval],
      workflow,
      outcomeMetrics: [outcomeMetric],
      dataLayers,
      rollout,
      harness,
    });

    expect(deployment.workflow?.name).toBe('Support escalation');
    expect(deployment.outcomeMetrics?.[0]?.target).toBe('under 5 minutes');
    expect(deployment.dataLayers?.feedback).toContain('approvals and corrections');
    expect(deployment.rollout?.stage).toBe('shadow');
    expect(deployment.harness?.phases.map((phase) => phase.name)).toContain('action');
    expect(deployment.harness?.toolRefs).toContain('ticket.get');
    expect(deployment.harness?.policyRefs).toContain('limit-cost');
    expect(deployment.harness?.evalRefs).toContain('support-triage-dataset');
    expectTypeOf(deployment.workflow?.scorecard?.volume).toEqualTypeOf<'high' | undefined>();
    expectTypeOf(deployment.harness?.review?.evalRefs).toEqualTypeOf<string[] | undefined>();
  });

  it('round-trips environment endpoint refs and resolves them against an environment', () => {
    const ref = environmentEndpoint('customer-api');

    expect(isEnvironmentEndpointRef(ref)).toBe(true);
    expect(isEnvironmentEndpointRef('http://127.0.0.1:8787')).toBe(false);
    expect(environmentEndpointConfigValue(ref)).toBe('environment://customer-api');
    expect(parseEnvironmentEndpointConfigValue('environment://customer-api')).toBe('customer-api');
    expect(parseEnvironmentEndpointConfigValue('http://127.0.0.1:8787')).toBeUndefined();

    const environment = defineEnvironment({
      name: 'docker-env',
      kind: 'local-docker',
      evidence: {
        kind: 'local-docker',
        name: 'docker-env',
        endpoints: [{ name: 'customer-api', url: 'http://127.0.0.1:8787' }],
      },
    });

    expect(resolveEnvironmentEndpoint(ref, environment)).toBe('http://127.0.0.1:8787');
    expect(resolveEnvironmentEndpoint('missing', environment)).toBeUndefined();
    expect(resolveEnvironmentEndpoint(ref, undefined)).toBeUndefined();
  });

  it('falls back to config.customerApi.url for the conventional customer-api endpoint', () => {
    const environment = defineEnvironment({
      name: 'docker-env',
      kind: 'local-docker',
      config: {
        customerApi: { url: 'http://127.0.0.1:9787' },
      },
    });

    expect(resolveEnvironmentEndpoint('customer-api', environment)).toBe('http://127.0.0.1:9787');
  });
});
