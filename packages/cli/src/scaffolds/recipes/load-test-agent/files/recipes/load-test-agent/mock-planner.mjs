import { asRecord, getNumber, getString } from '@fdekit/core';

export function createLoadTestMockPlanner() {
  return function loadTestMockPlanner(context) {
    const targetUrl = getString(context.input.targetUrl) ?? getString(context.input.url);
    const scenario = getString(context.input.scenario) ?? 'smoke';
    const vus = getNumber(context.input.vus);
    const duration = getString(context.input.duration);
    const runCall = findToolResult(context.toolResults, 'loadtest.run');

    if (!runCall) {
      return {
        type: 'tool_call',
        toolName: 'loadtest.run',
        args: {
          scenario,
          ...(targetUrl ? { targetUrl } : {}),
          ...(vus ? { vus } : {}),
          ...(duration ? { duration } : {}),
        },
        reason: 'Run the governed load test before reporting readiness.',
      };
    }

    const result = asRecord(runCall.result);
    const metrics = asRecord(result.metrics);
    const thresholds = asRecord(result.thresholds);
    const status = getString(result.status) ?? 'unknown';
    const mode = getString(result.mode) ?? 'unknown';
    const evidenceKind = getString(result.evidenceKind) ?? (mode === 'local' ? 'simulated' : 'measured');
    const p95 = getNumber(metrics.httpReqDurationP95Ms);
    const errorRate = getNumber(metrics.httpReqFailedRate);
    const effectiveTarget = getString(result.targetUrl) ?? targetUrl ?? 'configured target';
    const metricsSummary = `p95 latency ${p95 ?? 0}ms, error rate ${((errorRate ?? 0) * 100).toFixed(2)}%, threshold passed: ${String(thresholds.passed ?? false)}.`;
    const message = evidenceKind === 'simulated'
      ? `Load-test scenario simulated locally for ${effectiveTarget}. No HTTP request or k6 run was performed. Deterministic threshold outcome: ${status}; ${metricsSummary}`
      : `Load-test scenario measured with k6 for ${effectiveTarget}. Threshold outcome: ${status}; ${metricsSummary}`;

    return {
      type: 'final',
      message,
      metadata: {
        targetUrl: effectiveTarget,
        scenario,
        mode,
        evidenceKind,
        status,
        p95,
        errorRate,
      },
    };
  };
}

function findToolResult(toolResults, toolName) {
  return toolResults.find((result) => result.name === toolName);
}
