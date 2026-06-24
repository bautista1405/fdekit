import { describe, expect, it } from 'vitest';
import {
  defineAgent,
  defineDeployment,
  defineGovernance,
  defineHarness,
} from '@fdekit/core';
import type { TraceArtifact } from '../traces/index.js';
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

  it('surfaces latest run evidence and created issue links', () => {
    const deployment = defineDeployment({
      name: 'codebase-agent-example',
      environment: 'local',
      providers: {
        localOllama: { name: 'localOllama' },
      },
      connectors: {
        codebase: { name: 'codebase' },
        issues: { name: 'github' },
      },
      agents: {
        codebaseAgent: defineAgent({
          provider: 'localOllama',
          instructions: './agents/codebase-agent.md',
        }),
      },
    });
    const trace: TraceArtifact = {
      id: 'run_latest',
      createdAt: '2026-06-23T23:28:55.706Z',
      deployment: 'codebase-agent-example',
      events: [
        { type: 'agent.run.started', agent: 'codebaseAgent', provider: 'localOllama' },
        {
          type: 'tool.call.completed',
          toolName: 'codebase.search',
          result: {
            matches: [
              {
                filePath: 'src/billing.ts',
                line: 8,
                preview: '// TODO(fdekit): add retry and idempotency handling.',
              },
            ],
          },
        },
        {
          type: 'tool.call.completed',
          toolName: 'codebase.readFile',
          result: {
            filePath: 'src/billing.ts',
            startLine: 1,
            endLine: 16,
          },
        },
        {
          type: 'policy.evaluated',
          policy: 'limit-tool-scopes',
          toolName: 'issue.create',
          allowed: true,
        },
        {
          type: 'tool.call.completed',
          toolName: 'issue.create',
          args: {
            title: 'Add retry and idempotency to billing sync',
          },
          result: {
            id: '4730299904',
            number: 8,
            mode: 'api',
            repository: 'bautista1405/Calculator-made-with-React',
            title: 'Add retry and idempotency to billing sync',
            url: 'https://github.com/bautista1405/Calculator-made-with-React/issues/8',
          },
        },
        {
          type: 'agent.run.completed',
          status: 'completed',
          message: 'Issue created: https://github.com/bautista1405/Calculator-made-with-React/issues/8',
        },
      ],
    };

    const report = renderReport(deployment, null, [trace]);

    expect(report).toContain('## Run Reviewed');
    expect(report).toContain('- Trace: run_latest');
    expect(report).toContain('- Agent: codebaseAgent');
    expect(report).toContain('- Tool calls: codebase.search, codebase.readFile, issue.create');
    expect(report).toContain('src/billing.ts:8');
    expect(report).toContain('src/billing.ts:1-16');
    expect(report).toContain('Add retry and idempotency to billing sync [#8]');
    expect(report).toContain('https://github.com/bautista1405/Calculator-made-with-React/issues/8');
    expect(report).toContain('- Policy checks: 1');
    expect(report).toContain('- Policy violations: 0');
  });
});
