import { describe, expect, it } from 'vitest';
import {
  defineAgent,
  defineDeployment,
  defineGovernance,
  defineHarness,
} from '@fdekit/core';
import { collectReportPolicyNames, renderReport } from '../reports.js';

describe('deployment reports', () => {
  it('summarizes governance, harness, and agent policies', () => {
    const deployment = defineDeployment({
      name: 'governed-report',
      environment: 'local',
      providers: {
        mock: { name: 'mock' },
      },
      governance: defineGovernance({
        dataProtection: {
          denyPII: true,
          redactSecrets: true,
        },
        permissions: {
          allowedScopes: ['issues:write'],
          requireScopes: true,
        },
        environments: {
          allowed: ['local'],
          tools: ['issue.create'],
        },
        budgets: [
          { maxUsd: 0.25 },
        ],
      }),
      harness: defineHarness({
        name: 'governed-loop',
        phases: [
          {
            name: 'decision',
            policyRefs: ['deny-pii-leak', 'redact-secrets', 'limit-cost'],
          },
          {
            name: 'action',
            policyRefs: ['limit-tool-scopes', 'restrict-environments', 'agent-tool-limit'],
          },
        ],
        policyRefs: [
          'deny-pii-leak',
          'redact-secrets',
          'limit-tool-scopes',
          'restrict-environments',
          'limit-cost',
          'agent-tool-limit',
        ],
      }),
      agents: {
        supportTriage: defineAgent({
          provider: 'mock',
          instructions: './agents/support-triage.md',
          policies: [
            { name: 'agent-tool-limit' },
          ],
        }),
      },
    });

    expect(collectReportPolicyNames(deployment)).toEqual([
      'deny-pii-leak',
      'redact-secrets',
      'restrict-environments',
      'limit-tool-scopes',
      'limit-cost',
      'agent-tool-limit',
    ]);

    const report = renderReport(deployment, null, []);

    expect(report).toContain([
      '- Deployment policies: deny-pii-leak, redact-secrets, restrict-environments,',
      'limit-tool-scopes, limit-cost, agent-tool-limit',
    ].join(' '));
    expect(report).not.toContain('- Deployment policies: none');
  });
});
