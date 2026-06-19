import { describe, expect, it } from 'vitest';
import { k6Connector } from '../index.js';

describe('k6Connector', () => {
  it('runs a deterministic local load test with governance metadata', async () => {
    const connector = k6Connector({
      mode: 'local',
      targetUrl: 'http://localhost:8788',
      defaultVus: 4,
      defaultDuration: '10s',
      now: () => '2026-05-29T00:00:00.000Z',
    });
    const tool = connector.tools.find((candidate) => candidate.name === 'loadtest.run');

    expect(connector.config).toMatchObject({
      mode: 'local',
      targetUrl: 'http://localhost:8788',
      defaultVus: 4,
      defaultDuration: '10s',
    });
    expect(tool?.scopes).toEqual(['loadtest:run']);
    expect(tool?.environments).toEqual(['local', 'staging']);

    const result = await tool?.handler({ scenario: 'smoke' }, {
      agentName: 'loadTestAgent',
      toolName: 'loadtest.run',
    });

    expect(result).toMatchObject({
      mode: 'local',
      evidenceKind: 'simulated',
      status: 'passed',
      targetUrl: 'http://localhost:8788',
      vus: 4,
      duration: '10s',
      startedAt: '2026-05-29T00:00:00.000Z',
    });
  });

  it('honors a per-run target instead of replacing it with the connector default', async () => {
    const connector = k6Connector({
      mode: 'local',
      targetUrl: 'http://configured.local',
    });
    const tool = connector.tools.find((candidate) => candidate.name === 'loadtest.run');

    const result = await tool?.handler({
      scenario: 'smoke',
      targetUrl: 'http://requested.local/path/',
    }, {
      agentName: 'loadTestAgent',
      toolName: 'loadtest.run',
    });

    expect(result).toMatchObject({
      evidenceKind: 'simulated',
      targetUrl: 'http://requested.local/path',
    });
  });

  it('invokes k6 mode through an injectable command runner', async () => {
    const invocations: unknown[] = [];
    const connector = k6Connector({
      mode: 'k6',
      k6Command: '/usr/local/bin/k6',
      scriptPath: './load-tests/api.js',
      targetUrl: 'http://customer.local',
      runCommand: async (invocation) => {
        invocations.push(invocation);
        return {
          exitCode: 0,
          stdout: 'http_req_duration...............: avg=100ms p(95)=245ms\nhttp_req_failed................: 0.00%\nchecks.........................: 100.00%\niterations.....................: 12\nhttp_reqs......................: 36\n',
          stderr: '',
          durationMs: 321,
        };
      },
      now: () => '2026-05-29T00:00:00.000Z',
    });
    const tool = connector.tools.find((candidate) => candidate.name === 'loadtest.run');
    const result = await tool?.handler({
      vus: 3,
      duration: '4s',
      tags: { account: 'company' },
    }, {
      agentName: 'loadTestAgent',
      toolName: 'loadtest.run',
    });

    expect(invocations).toHaveLength(1);
    expect(invocations[0]).toMatchObject({
      command: '/usr/local/bin/k6',
      args: expect.arrayContaining(['run', '--vus', '3', '--duration', '4s', './load-tests/api.js']),
      env: expect.objectContaining({
        LOAD_TEST_TARGET_URL: 'http://customer.local',
        FDEKIT_K6_TAG_ACCOUNT: 'company',
      }),
    });
    expect(result).toMatchObject({
      mode: 'k6',
      evidenceKind: 'measured',
      status: 'passed',
      metrics: {
        httpReqDurationP95Ms: 245,
        httpReqFailedRate: 0,
        checksSucceededRate: 1,
        iterations: 12,
        requests: 36,
      },
    });
  });

  it('prefers measured metrics from the k6 summary artifact', async () => {
    const connector = k6Connector({
      mode: 'k6',
      runCommand: async () => ({
        exitCode: 0,
        stdout: 'custom handleSummary suppressed the default text summary',
        stderr: '',
        durationMs: 321,
        summary: {
          metrics: {
            http_req_duration: { values: { 'p(95)': 27.4 } },
            http_req_failed: { values: { rate: 0 } },
            checks: { values: { rate: 1 } },
            iterations: { values: { count: 6 } },
            http_reqs: { values: { count: 18 } },
          },
        },
      }),
    });
    const tool = connector.tools.find((candidate) => candidate.name === 'loadtest.run');

    const result = await tool?.handler({}, {
      agentName: 'loadTestAgent',
      toolName: 'loadtest.run',
    });

    expect(result).toMatchObject({
      mode: 'k6',
      evidenceKind: 'measured',
      status: 'passed',
      metrics: {
        httpReqDurationP95Ms: 27.4,
        httpReqFailedRate: 0,
        checksSucceededRate: 1,
        iterations: 6,
        requests: 18,
      },
    });
  });

  it('does not pass a k6 run when no measured metrics can be parsed', async () => {
    const connector = k6Connector({
      mode: 'k6',
      runCommand: async () => ({
        exitCode: 0,
        stdout: 'k6 completed without a parseable summary',
        stderr: '',
        durationMs: 100,
      }),
    });
    const tool = connector.tools.find((candidate) => candidate.name === 'loadtest.run');

    const result = await tool?.handler({}, {
      agentName: 'loadTestAgent',
      toolName: 'loadtest.run',
    });

    expect(result).toMatchObject({
      mode: 'k6',
      evidenceKind: 'measured',
      status: 'failed',
      thresholds: {
        passed: false,
      },
    });
  });

  it('rejects unsafe load settings above configured caps', async () => {
    const connector = k6Connector({ maxVus: 5, maxDurationSeconds: 10 });
    const tool = connector.tools.find((candidate) => candidate.name === 'loadtest.run');

    await expect(tool?.handler({
      vus: 6,
      duration: '5s',
    }, {
      agentName: 'loadTestAgent',
      toolName: 'loadtest.run',
    })).rejects.toThrow('exceeds connector maxVus');

    await expect(tool?.handler({
      vus: 5,
      duration: '11s',
    }, {
      agentName: 'loadTestAgent',
      toolName: 'loadtest.run',
    })).rejects.toThrow('exceeds connector maxDurationSeconds');
  });
});
