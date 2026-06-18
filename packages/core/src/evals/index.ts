import type { EvalAssertion, EvalAssertionResult, EvalRunContext, MaybePromise } from '../types/index.js';

export function expectedToolCall(toolName: string, options: {
  name?: string;
  description?: string;
  minCalls?: number;
} = {}): EvalAssertion {
  const minCalls = options.minCalls ?? 1;

  return {
    name: options.name ?? `expected-tool-call:${toolName}`,
    description: options.description ?? `Expected at least ${minCalls} call(s) to ${toolName}`,
    evaluate(context) {
      const count = (context.toolCalls ?? []).filter((call) => call.name === toolName).length;

      return {
        passed: count >= minCalls,
        message: count >= minCalls
          ? `Observed ${count} call(s) to ${toolName}`
          : `Expected ${minCalls} call(s) to ${toolName}; observed ${count}`,
        score: count >= minCalls ? 1 : 0,
        metadata: { count, minCalls },
      };
    },
  };
}

export function notExpectedToolCall(toolName: string, options: {
  name?: string;
  description?: string;
} = {}): EvalAssertion {
  return {
    name: options.name ?? `not-expected-tool-call:${toolName}`,
    description: options.description ?? `Expected no calls to ${toolName}`,
    evaluate(context) {
      const count = (context.toolCalls ?? []).filter((call) => call.name === toolName).length;

      return {
        passed: count === 0,
        message: count === 0
          ? `No calls to ${toolName} observed`
          : `Expected no calls to ${toolName}; observed ${count}`,
        score: count === 0 ? 1 : 0,
        metadata: { count },
      };
    },
  };
}

export function expectedFinalAnswer(expected: string | RegExp | ((answer: string) => boolean), options: {
  name?: string;
  description?: string;
} = {}): EvalAssertion {
  return {
    name: options.name ?? 'expected-final-answer',
    description: options.description ?? 'Check the final answer against an expected value',
    evaluate(context) {
      const answer = context.finalAnswer ?? '';
      const passed = typeof expected === 'string'
        ? answer.includes(expected)
        : expected instanceof RegExp
          ? expected.test(answer)
          : expected(answer);

      return {
        passed,
        message: passed ? 'Final answer matched' : 'Final answer did not match',
        score: passed ? 1 : 0,
      };
    },
  };
}

export function judgeRubric(options: {
  rubric: string;
  name?: string;
  description?: string;
  judge?: (context: EvalRunContext, rubric: string) => MaybePromise<EvalAssertionResult>;
}): EvalAssertion {
  return {
    name: options.name ?? 'judge-rubric',
    description: options.description ?? options.rubric,
    configurationIssues: options.judge
      ? undefined
      : [{
        path: 'judge',
        message: 'judgeRubric requires a judge function; FDEKit does not provide a built-in provider-backed judge',
      }],
    async evaluate(context) {
      if (!options.judge) {
        return {
          passed: false,
          message: 'No judge function configured for rubric eval',
          score: 0,
          metadata: { rubric: options.rubric },
        };
      }

      return options.judge(context, options.rubric);
    },
  };
}

export function maxLatency(maxMs: number, options: {
  name?: string;
  description?: string;
} = {}): EvalAssertion {
  return {
    name: options.name ?? 'max-latency',
    description: options.description ?? `Require latency under ${maxMs}ms`,
    evaluate(context) {
      const latency = context.latencyMs ?? 0;

      return {
        passed: latency <= maxMs,
        message: `${latency}ms / ${maxMs}ms`,
        score: latency <= maxMs ? 1 : 0,
        metadata: { latencyMs: latency, maxMs },
      };
    },
  };
}

export function maxCost(maxUsd: number, options: {
  name?: string;
  description?: string;
} = {}): EvalAssertion {
  return {
    name: options.name ?? 'max-cost',
    description: options.description ?? `Require run cost under $${maxUsd}`,
    evaluate(context) {
      const cost = context.costUsd ?? 0;

      return {
        passed: cost <= maxUsd,
        message: `$${cost.toFixed(4)} / $${maxUsd.toFixed(4)}`,
        score: cost <= maxUsd ? 1 : 0,
        metadata: { costUsd: cost, maxUsd },
      };
    },
  };
}

export function noPolicyViolation(options: {
  name?: string;
  description?: string;
} = {}): EvalAssertion {
  return {
    name: options.name ?? 'no-policy-violation',
    description: options.description ?? 'Require no policy violations',
    evaluate(context) {
      const violations = context.policyViolations ?? [];

      return {
        passed: violations.length === 0,
        message: violations.length === 0
          ? 'No policy violations observed'
          : `${violations.length} policy violation(s) observed`,
        score: violations.length === 0 ? 1 : 0,
        metadata: { violations },
      };
    },
  };
}
