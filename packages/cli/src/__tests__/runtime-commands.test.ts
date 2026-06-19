import { readFile, readdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { cmdApprovals } from '../commands/approvals.js';
import { cmdAudit } from '../commands/audit.js';
import { cmdConsole } from '../commands/console.js';
import { cmdDiff } from '../commands/diff.js';
import { cmdEval } from '../commands/eval.js';
import { cmdFeedback } from '../commands/feedback.js';
import { cmdReport } from '../commands/report.js';
import { cmdRun } from '../commands/run.js';
import { cmdTrace } from '../commands/trace.js';
import { cmdValidate } from '../commands/validate.js';
import { printCliError } from '../errors.js';
import {
  captureCommand,
  createCliProject,
  expectFiles,
  mkProjectRoot,
  readJsonDir,
} from './helpers.js';

vi.setConfig({ testTimeout: 30000 });

describe('cli runtime commands', () => {
  it('reports missing rubric judges during validation', async () => {
    const projectDir = await createCliProject();
    const configPath = path.join(projectDir, 'fde.config.ts');
    const config = (await readFile(configPath, 'utf8'))
      .replace('  noPolicyViolation,\n', '  judgeRubric,\n  noPolicyViolation,\n')
      .replace(
        '        noPolicyViolation(),\n',
        "        judgeRubric({ rubric: 'Answer must be polite and complete.' }),\n        noPolicyViolation(),\n",
      );
    await writeFile(configPath, config, 'utf8');

    const output = await captureCommand(() => cmdValidate({ cwd: projectDir, args: [] }));

    expect(output.exitCode).toBe(1);
    expect(output.stdout).toContain(
      'ERROR evals.support-triage-dataset.assertions.judge-rubric.judge: '
      + 'judgeRubric requires a judge function; FDEKit does not provide a built-in provider-backed judge',
    );
    expect(output.stdout).toContain('Summary: deployment config has validation errors');
  });

  it('keeps config-free trace output inside the contained project directory', async () => {
    const customerRoot = await mkProjectRoot('fdekit-cli-contained-trace-');
    await writeFile(path.join(customerRoot, 'package.json'), '{"name":"customer-app","private":true}\n', 'utf8');

    const output = await captureCommand(() => cmdTrace({ cwd: customerRoot, args: [] }));

    expect(output.exitCode).toBeUndefined();
    expect(output.stdout).toContain(path.join(customerRoot, 'fdekit', 'artifacts', 'trace-viewer.html'));
    await expectFiles(path.join(customerRoot, 'fdekit'), ['artifacts/trace-viewer.html']);
    expect(await readdir(customerRoot)).toEqual(['fdekit', 'package.json']);
  });

  it('runs a configured agent and writes a trace artifact', async () => {
    const projectDir = await createCliProject();

    const output = await captureCommand(() => cmdRun({
      cwd: projectDir,
      args: ['supportTriage', '--ticket', 'tick_1001'],
    }));

    expect(output.exitCode).toBeUndefined();
    expect(output.stdout).toContain('Agent: supportTriage');
    expect(output.stdout).toContain('Status: completed');
    expect(output.stdout).toContain('Tool calls: ticket.get, customer.get, issue.create, slack.message, ticket.escalate');
    expect(output.stdout).toContain('Final answer: company Bank ticket tick_1001 was escalated');

    const traces = await readJsonDir(path.join(projectDir, 'artifacts', 'traces'));
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({
      deployment: 'cli-test-deployment',
    });
  });

  it('persists policy-blocked runs for macro evals, traces, and console', async () => {
    const projectDir = await createCliProject();
    const configPath = path.join(projectDir, 'fde.config.ts');
    const config = (await readFile(configPath, 'utf8'))
      .replace('  noPolicyViolation,\n', '  limitToolScopes,\n  noPolicyViolation,\n')
      .replace(
        '  agents: {\n',
        "  policies: [limitToolScopes({ allowed: [], requireScopes: true })],\n  agents: {\n",
      );
    await writeFile(configPath, config, 'utf8');

    const runOutput = await captureCommand(async () => {
      try {
        await cmdRun({
          cwd: projectDir,
          args: ['supportTriage', '--ticket', 'tick_1001'],
        });
      } catch (err) {
        printCliError(err);
        process.exitCode = 1;
      }
    });

    expect(runOutput.exitCode).toBe(1);
    expect(runOutput.stdout).toContain('Trace written:');
    expect(runOutput.stderr).toContain('Error: Policy "limit-tool-scopes" blocked ticket.get');

    const traces = await readJsonDir(path.join(projectDir, 'artifacts', 'traces')) as Array<{
      id: string;
      events: Array<Record<string, unknown>>;
    }>;
    expect(traces).toHaveLength(1);
    expect(traces[0].events.at(-1)).toMatchObject({
      type: 'agent.run.completed',
      status: 'failed',
    });

    const macroOutput = await captureCommand(() => cmdEval({
      cwd: projectDir,
      args: ['macro'],
    }));
    expect(macroOutput.stdout).toContain('Traces analyzed: 1');
    const macroArtifact = JSON.parse(await readFile(
      path.join(projectDir, 'artifacts', 'evals', 'macro', 'latest.json'),
      'utf8',
    )) as {
      traceDocuments?: Array<{
        traceId?: string;
        runOutcome?: string;
        behaviorSignals?: string[];
      }>;
      patterns?: Array<{ behaviorPattern?: string; affectedTraceIds?: string[] }>;
    };
    expect(macroArtifact.traceDocuments?.[0]).toMatchObject({
      traceId: traces[0].id,
      runOutcome: 'failed',
      behaviorSignals: expect.arrayContaining(['run failure', 'policy or guardrail']),
    });
    expect(macroArtifact.patterns).toEqual(expect.arrayContaining([
      expect.objectContaining({
        behaviorPattern: 'Run Failure',
        affectedTraceIds: [traces[0].id],
      }),
    ]));

    const traceOutput = await captureCommand(() => cmdTrace({ cwd: projectDir, args: [] }));
    expect(traceOutput.stdout).toContain('Traces loaded: 1');
    const viewer = await readFile(path.join(projectDir, 'artifacts', 'trace-viewer.html'), 'utf8');
    expect(viewer).toContain('"status": "failed"');

    const consoleOutput = await captureCommand(() => cmdConsole({ cwd: projectDir, args: [] }));
    expect(consoleOutput.stdout).toContain('Traces loaded: 1');
    const dashboard = JSON.parse(await readFile(
      path.join(projectDir, 'artifacts', 'exports', 'dashboard-data.json'),
      'utf8',
    )) as { runs?: Array<{ traceId?: string; status?: string }> };
    expect(dashboard.runs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        traceId: traces[0].id,
        status: 'failed',
      }),
    ]));
  });


  it('pauses runs for approval gates and exposes approvals plus audit logs', async () => {
    const projectDir = await createCliProject({ requireIssueApproval: true });

    const firstRun = await captureCommand(() => cmdRun({
      cwd: projectDir,
      args: ['supportTriage', '--ticket', 'tick_1001'],
    }));

    expect(firstRun.exitCode).toBe(1);
    expect(firstRun.stdout).toContain('Status: waiting_approval');
    expect(firstRun.stdout).toContain('Approvals: appr_');
    expect(firstRun.stdout).toContain('Next: fdekit approvals approve');

    const approvals = await readJsonDir(path.join(projectDir, 'artifacts', 'approvals')) as Array<{
      id: string;
      status: string;
      toolName: string;
    }>;
    expect(approvals).toHaveLength(1);
    expect(approvals[0]).toMatchObject({
      status: 'pending',
      toolName: 'issue.create',
    });

    const listOutput = await captureCommand(() => cmdApprovals({
      cwd: projectDir,
      args: ['list'],
    }));

    expect(listOutput.exitCode).toBeUndefined();
    expect(listOutput.stdout).toContain(approvals[0].id);
    expect(listOutput.stdout).toContain('pending');
    expect(listOutput.stdout).toContain('Issue creation needs FDE approval');

    const approveOutput = await captureCommand(() => cmdApprovals({
      cwd: projectDir,
      args: ['approve', approvals[0].id, '--by', 'bautista', '--reason', 'Customer approved this issue'],
    }));

    expect(approveOutput.exitCode).toBeUndefined();
    expect(approveOutput.stdout).toContain(`Approval approved: ${approvals[0].id}`);

    const secondRun = await captureCommand(() => cmdRun({
      cwd: projectDir,
      args: ['supportTriage', '--ticket', 'tick_1001'],
    }));

    expect(secondRun.exitCode).toBeUndefined();
    expect(secondRun.stdout).toContain('Status: completed');
    expect(secondRun.stdout).toContain(`${approvals[0].id} (approved)`);
    expect(secondRun.stdout).toContain('Tool calls: ticket.get, customer.get, issue.create, slack.message, ticket.escalate');

    const auditOutput = await captureCommand(() => cmdAudit({
      cwd: projectDir,
      args: ['--limit', '50'],
    }));

    expect(auditOutput.exitCode).toBeUndefined();
    expect(auditOutput.stdout).toContain('Audit log:');
    expect(auditOutput.stdout).toContain('approval.requested');
    expect(auditOutput.stdout).toContain('approval.approved');
    expect(auditOutput.stdout).toContain('approval.satisfied');

    const feedbackOutput = await captureCommand(() => cmdFeedback({
      cwd: projectDir,
      args: ['export'],
    }));

    expect(feedbackOutput.exitCode).toBeUndefined();
    expect(feedbackOutput.stdout).toContain('FDEKit feedback export');
    expect(feedbackOutput.stdout).toContain('Feedback candidates: 1');
    const feedbackArtifact = JSON.parse(await readFile(
      path.join(projectDir, 'artifacts', 'feedback', 'eval-candidates.json'),
      'utf8',
    )) as {
      source?: { decidedApprovals?: number };
      cases?: Array<{
        input?: Record<string, unknown>;
        expected?: { humanDecision?: string; shouldProceed?: boolean };
        metadata?: {
          approvalId?: string;
          args?: unknown;
          humanDecision?: string;
          inputSource?: string;
        };
      }>;
    };
    expect(feedbackArtifact.source?.decidedApprovals).toBe(1);
    expect(feedbackArtifact.cases).toHaveLength(1);
    expect(feedbackArtifact.cases?.[0]?.metadata?.approvalId).toBe(approvals[0].id);
    expect(feedbackArtifact.cases?.[0]?.input).toEqual({ ticketId: 'tick_1001' });
    expect(feedbackArtifact.cases?.[0]?.metadata).toMatchObject({
      args: expect.objectContaining({ ticketId: 'tick_1001' }),
      humanDecision: 'approved',
      inputSource: 'trace',
    });
    expect(feedbackArtifact.cases?.[0]?.expected).toMatchObject({
      humanDecision: 'approved',
      shouldProceed: true,
    });
    const feedbackCases = JSON.parse(await readFile(
      path.join(projectDir, 'artifacts', 'feedback', 'eval-cases.json'),
      'utf8',
    )) as unknown[];
    expect(feedbackCases).toHaveLength(1);

    const configPath = path.join(projectDir, 'fde.config.ts');
    const config = await readFile(configPath, 'utf8');
    await writeFile(
      configPath,
      config.replace(
        '  evals: [',
        `  evals: [
    defineEval({
      name: 'approval-feedback-replay',
      agent: 'supportTriage',
      dataset: './artifacts/feedback/eval-cases.json',
      maxSteps: 8,
      assertions: [expectedApprovalOutcome()],
    }),`,
      ),
      'utf8',
    );

    const feedbackEvalOutput = await captureCommand(() => cmdEval({
      cwd: projectDir,
      args: ['run'],
    }));

    expect(feedbackEvalOutput.exitCode).toBeUndefined();
    const feedbackEval = JSON.parse(await readFile(
      path.join(projectDir, 'artifacts', 'evals', 'latest.json'),
      'utf8',
    )) as {
      results?: Array<{
        name?: string;
        status?: string;
        cases?: Array<{ assertions?: Array<{ message?: string; passed?: boolean }> }>;
      }>;
    };
    const replayResult = feedbackEval.results?.find((result) => result.name === 'approval-feedback-replay');
    expect(replayResult?.status).toBe('passed');
    expect(replayResult?.cases?.[0]?.assertions).toContainEqual(expect.objectContaining({
      passed: true,
      message: 'Expected approved tool "issue.create" to proceed',
    }));

    const consoleOutput = await captureCommand(() => cmdConsole({ cwd: projectDir, args: [] }));
    expect(consoleOutput.stdout).toContain('Approvals loaded: 1');
    expect(consoleOutput.stdout).toContain('Audit entries loaded:');
    const workbenchHtml = await readFile(path.join(projectDir, 'artifacts', 'workbench.html'), 'utf8');
    expect(workbenchHtml).toContain('Governance Review');
    expect(workbenchHtml).toContain('Approval Queue');
    expect(workbenchHtml).toContain(approvals[0].id);
  });


  it('runs evals, writes latest results, and renders reports/viewers', async () => {
    const projectDir = await createCliProject();

    const evalOutput = await captureCommand(() => cmdEval({ cwd: projectDir, args: ['run'] }));

    expect(evalOutput.exitCode).toBeUndefined();
    expect(evalOutput.stdout).toContain('Eval status: passed');
    expect(evalOutput.stdout).toContain('Eval suites: 1');

    const latestEval = JSON.parse(await readFile(
      path.join(projectDir, 'artifacts', 'evals', 'latest.json'),
      'utf8',
    )) as { status?: string; results?: unknown[] };
    expect(latestEval.status).toBe('passed');
    expect(latestEval.results).toHaveLength(1);

    const reportOutput = await captureCommand(() => cmdReport({ cwd: projectDir, args: [] }));
    expect(reportOutput.stdout).toContain('Report written:');

    const report = await readFile(path.join(projectDir, 'artifacts', 'reports', 'deployment-report.md'), 'utf8');
    expect(report).toContain('# cli-test-deployment Deployment Report');
    expect(report).toContain('- Status: passed');

    const macroOutput = await captureCommand(() => cmdEval({ cwd: projectDir, args: ['macro'] }));
    expect(macroOutput.exitCode).toBeUndefined();
    expect(macroOutput.stdout).toContain('Macro eval patterns:');
    expect(macroOutput.stdout).toContain('Focus pattern:');
    const macroArtifact = JSON.parse(await readFile(path.join(projectDir, 'artifacts', 'evals', 'macro', 'latest.json'), 'utf8')) as {
      traceDocuments?: unknown[];
      patterns?: unknown[];
    };
    expect(macroArtifact.traceDocuments?.length).toBeGreaterThan(0);
    expect(macroArtifact.patterns?.length).toBeGreaterThan(0);
    const macroReport = await readFile(path.join(projectDir, 'artifacts', 'evals', 'macro', 'report.md'), 'utf8');
    expect(macroReport).toContain('Macro Eval Report');

    const traceOutput = await captureCommand(() => cmdTrace({ cwd: projectDir, args: [] }));
    expect(traceOutput.stdout).toContain('Trace viewer created:');
    expect(traceOutput.stdout).toContain('Traces loaded: 2');

    const viewer = await readFile(path.join(projectDir, 'artifacts', 'trace-viewer.html'), 'utf8');
    expect(viewer).toContain('FDEKit Trace Viewer');

    const consoleOutput = await captureCommand(() => cmdConsole({ cwd: projectDir, args: [] }));
    expect(consoleOutput.stdout).toContain('Console created:');
    expect(consoleOutput.stdout).toContain('Console snapshot:');
    expect(consoleOutput.stdout).toContain('Exports written:');
    expect(consoleOutput.stdout).toContain('Eval status: passed');

    const consoleHtml = await readFile(path.join(projectDir, 'artifacts', 'console.html'), 'utf8');
    expect(consoleHtml).toContain('FDEKit Console');
    expect(consoleHtml).toContain('cli-test-deployment');
    expect(consoleHtml).toContain('Export dashboard data');
    expect(consoleHtml).toContain('downloadExport');
    expect(consoleHtml).toContain('href="charts.html"');
    expect(consoleHtml).toContain('href="workbench.html"');
    const chartsHtml = await readFile(path.join(projectDir, 'artifacts', 'charts.html'), 'utf8');
    expect(chartsHtml).toContain('Deployment Charts');
    const workbenchHtml = await readFile(path.join(projectDir, 'artifacts', 'workbench.html'), 'utf8');
    expect(workbenchHtml).toContain('support-triage-dataset');
    expect(workbenchHtml).toContain('Review Gates');
    expect(workbenchHtml).toContain('Governance Review');
    expect(workbenchHtml).toContain('Slack Notifications');
    expect(workbenchHtml).toContain('Customer Report');
    expect(workbenchHtml).not.toContain('Macro Evals');
    expect(workbenchHtml).not.toContain('Dashboard History');
    const consolePages = await readdir(path.join(projectDir, 'artifacts'));
    expect(consolePages).toEqual(expect.arrayContaining([
      'console.html',
      'charts.html',
      'brief.html',
      'readiness.html',
      'workbench.html',
    ]));
    const consoleSnapshots = await readdir(path.join(projectDir, 'artifacts', 'consoles'));
    expect(consoleSnapshots.some((entry) => entry.startsWith('console-') && entry.endsWith('.html'))).toBe(true);
    const consoleHistory = JSON.parse(await readFile(path.join(projectDir, 'artifacts', 'consoles', 'history.json'), 'utf8')) as unknown[];
    expect(consoleHistory).toHaveLength(1);
    const exportEntries = await readdir(path.join(projectDir, 'artifacts', 'exports'));
    expect(exportEntries).toEqual(expect.arrayContaining(['dashboard.csv', 'dashboard.md', 'dashboard-data.json']));
    const dashboardCsv = await readFile(path.join(projectDir, 'artifacts', 'exports', 'dashboard.csv'), 'utf8');
    expect(dashboardCsv).toContain('record_type,id,created_at,status,title');
    expect(dashboardCsv).toContain('issue');
    const dashboardMarkdown = await readFile(path.join(projectDir, 'artifacts', 'exports', 'dashboard.md'), 'utf8');
    expect(dashboardMarkdown).toContain('# cli-test-deployment Dashboard Export');
  });


  it('surfaces invalid field-method metadata through validate', async () => {
    const projectDir = await mkProjectRoot('fdekit-cli-field-method-');
    await writeFile(path.join(projectDir, 'fde.config.ts'), `import {
  defineAgent,
  defineDeployment,
  defineOutcomeMetric,
  defineRollout,
} from '@fdekit/core';

export default defineDeployment({
  name: 'invalid-field-method-metadata',
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    reviewer: defineAgent({
      provider: 'mock',
      instructions: './agents/reviewer.md',
    }),
  },
  outcomeMetrics: [
    defineOutcomeMetric({ description: 'Missing its required name' } as any),
  ],
  rollout: defineRollout({
    stage: 12345 as any,
    owner: { team: 'operations' } as any,
  }),
});
`, 'utf8');

    const output = await captureCommand(() => cmdValidate({ cwd: projectDir, args: [] }));

    expect(output.exitCode).toBe(1);
    expect(output.stdout).toContain(
      'ERROR outcomeMetrics.0.name: Outcome metric name must be a non-empty string',
    );
    expect(output.stdout).toContain(
      'ERROR rollout.stage: Rollout stage must be a non-empty string',
    );
    expect(output.stdout).toContain(
      'ERROR rollout.owner: Rollout owner must be a string',
    );
    expect(output.stdout).toContain('Summary: deployment config has validation errors');
  });

  it('reports an incomplete S3 artifact store without throwing during validate', async () => {
    const projectDir = await mkProjectRoot('fdekit-cli-invalid-s3-');
    await writeFile(path.join(projectDir, 'fde.config.ts'), `import {
  defineAgent,
  defineDeployment,
} from '@fdekit/core';

export default defineDeployment({
  name: 'invalid-s3-artifacts',
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    reviewer: defineAgent({
      provider: 'mock',
      instructions: './agents/reviewer.md',
    }),
  },
  artifacts: {
    kind: 's3',
    bucket: 'fdekit-artifacts',
  } as any,
});
`, 'utf8');

    const output = await captureCommand(() => cmdValidate({ cwd: projectDir, args: [] }));

    expect(output.exitCode).toBe(1);
    expect(output.stdout).toContain(
      'ERROR artifacts.client: S3 artifact store requires a client with putObject, getObject, and listObjectsV2 methods',
    );
    expect(output.stdout).toContain(
      'Artifacts: not written because the artifact store configuration is invalid',
    );
    expect(output.stdout).toContain('Summary: deployment config has validation errors');
  });

  it('validates deployments, writes snapshots, and diffs config changes', async () => {
    const projectDir = await createCliProject();

    const validateOutput = await captureCommand(() => cmdValidate({ cwd: projectDir, args: [] }));

    expect(validateOutput.exitCode).toBeUndefined();
    expect(validateOutput.stdout).toContain('FDEKit validate');
    expect(validateOutput.stdout).toContain('Deployment: cli-test-deployment');
    expect(validateOutput.stdout).toContain('Mode: standard');
    expect(validateOutput.stdout).toContain('Snapshot:');
    expect(validateOutput.stdout).toContain('Execution plan:');
    expect(validateOutput.stdout).toContain('Summary: deployment config is valid');

    const latestPath = path.join(projectDir, 'artifacts', 'deployments', 'latest.json');
    const latestSnapshot = JSON.parse(await readFile(latestPath, 'utf8')) as {
      deployment?: {
        name?: string;
        providers?: {
          mock?: {
            model?: string;
          };
        };
      };
    };
    expect(latestSnapshot.deployment?.name).toBe('cli-test-deployment');

    const planPath = path.join(projectDir, 'artifacts', 'deployments', 'execution-plan.json');
    const executionPlan = JSON.parse(await readFile(planPath, 'utf8')) as {
      valid?: boolean;
      agents?: {
        supportTriage?: {
          provider?: {
            key?: string;
            runtime?: {
              source?: string;
            };
          };
        };
      };
    };
    expect(executionPlan.valid).toBe(true);
    expect(executionPlan.agents?.supportTriage?.provider).toMatchObject({
      key: 'mock',
      runtime: { source: 'mock-fallback' },
    });

    const configPath = path.join(projectDir, 'fde.config.ts');
    const config = await readFile(configPath, 'utf8');
    await writeFile(
      configPath,
      config.replace("name: 'mock',\n      options:", "name: 'mock',\n      model: 'mock-v2',\n      options:"),
      'utf8',
    );

    const diffOutput = await captureCommand(() => cmdDiff({ cwd: projectDir, args: [] }));

    expect(diffOutput.exitCode).toBeUndefined();
    expect(diffOutput.stdout).toContain('FDEKit diff');
    expect(diffOutput.stdout).toContain('+ providers.mock.model');
    expect(diffOutput.stdout).toContain('"mock-v2"');
  });

});
