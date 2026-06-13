import type { ConsoleMetrics } from '../../interfaces/index.js';
import { percentile } from '../format.js';
import type { MetricsContext } from './context.js';

export type ToolMetrics = Pick<
  ConsoleMetrics,
  | 'policyViolationCount'
  | 'toolCallCount'
  | 'avgLatencyMs'
  | 'p95LatencyMs'
  | 'maxLatencyMs'
  | 'totalCostUsd'
  | 'toolCounts'
>;

export function collectToolMetrics(context: MetricsContext): ToolMetrics {
  const toolLatency = new Map<string, { count: number; totalLatencyMs: number }>();

  for (const event of context.toolEvents) {
    const toolName = typeof event.toolName === 'string' ? event.toolName : 'unknown';
    const latencyMs = typeof event.latencyMs === 'number' ? event.latencyMs : 0;
    const current = toolLatency.get(toolName) ?? { count: 0, totalLatencyMs: 0 };
    toolLatency.set(toolName, {
      count: current.count + 1,
      totalLatencyMs: current.totalLatencyMs + latencyMs,
    });
  }

  const latencySamples = context.completedRuns
    .map((event) => typeof event.latencyMs === 'number' ? event.latencyMs : 0)
    .filter((latency) => latency >= 0);
  const totalCostUsd = context.completedRuns.reduce(
    (total, event) => total + (typeof event.costUsd === 'number' ? event.costUsd : 0),
    0,
  );

  return {
    policyViolationCount: countPolicyViolations(context.completedRuns),
    toolCallCount: context.toolEvents.length,
    avgLatencyMs: latencySamples.length > 0
      ? latencySamples.reduce((total, latency) => total + latency, 0) / latencySamples.length
      : 0,
    p95LatencyMs: percentile(latencySamples, 95),
    maxLatencyMs: latencySamples.length > 0 ? Math.max(...latencySamples) : 0,
    totalCostUsd,
    toolCounts: [...toolLatency.entries()]
      .map(([name, value]) => ({
        name,
        count: value.count,
        avgLatencyMs: value.count > 0 ? value.totalLatencyMs / value.count : 0,
      }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
  };
}

function countPolicyViolations(events: MetricsContext['completedRuns']): number {
  return events.reduce((total, event) => {
    const violations = Array.isArray(event.policyViolations) ? event.policyViolations.length : 0;
    return total + violations;
  }, 0);
}
