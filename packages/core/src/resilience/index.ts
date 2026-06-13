import type {
  CircuitBreakerPolicy,
  CircuitBreakerState,
  HttpResilienceClient,
  HttpResilienceOptions,
  RetryPolicy,
} from '../types/index.js';

type NormalizedRetryPolicy = Required<Omit<RetryPolicy, 'retryStatusCodes'>> & {
  retryStatusCodes: number[];
};

interface MutableCircuitBreakerState extends CircuitBreakerState {
  failureThreshold: number;
  resetTimeoutMs: number;
  enabled: boolean;
}

export function createHttpReq(options: HttpResilienceOptions = {}): HttpResilienceClient {
  const retry = normalizeRetryPolicy(options.retry);
  const circuit = createCircuitBreakerState(options.circuitBreaker);
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const operationName = options.operationName ?? 'external request';

  return {
    async request(fetchImpl, input, init) {
      assertCircuitAllowsRequest(circuit, now, operationName);

      let lastError: unknown;

      for (let attempt = 1; attempt <= retry.maxAttempts; attempt += 1) {
        let retryAfterMs: number | undefined;

        try {
          const response = await fetchImpl(input, init);
          const retryable = retry.retryStatusCodes.includes(response.status);

          if (response.ok || !retryable) {
            recordCircuitSuccess(circuit);
            return response;
          }

          if (attempt >= retry.maxAttempts) {
            recordCircuitFailure(circuit, now);
            return response;
          }

          retryAfterMs = retryAfterDelayMs(response, retry, now);
        } catch (err) {
          lastError = err;

          if (attempt >= retry.maxAttempts) {
            recordCircuitFailure(circuit, now);
            throw err;
          }
        }

        await sleep(retryAfterMs ?? retryDelayMs(retry, attempt, random));
      }

      recordCircuitFailure(circuit, now);
      throw lastError instanceof Error ? lastError : new Error(`Failed ${operationName}`);
    },
    getCircuitState() {
      return {
        status: circuit.status,
        failureCount: circuit.failureCount,
        openedAt: circuit.openedAt,
      };
    },
  };
}

function normalizeRetryPolicy(value: boolean | RetryPolicy | undefined): NormalizedRetryPolicy {
  if (value === false) {
    return {
      maxAttempts: 1,
      initialDelayMs: 0,
      maxDelayMs: 0,
      backoffFactor: 1,
      jitter: false,
      retryStatusCodes: [],
      maxRetryAfterMs: 0,
    };
  }

  const policy = typeof value === 'object' && value ? value : {};

  return {
    maxAttempts: Math.max(1, policy.maxAttempts ?? 3),
    initialDelayMs: Math.max(0, policy.initialDelayMs ?? 250),
    maxDelayMs: Math.max(0, policy.maxDelayMs ?? 2_000),
    backoffFactor: Math.max(1, policy.backoffFactor ?? 2),
    jitter: policy.jitter ?? true,
    retryStatusCodes: policy.retryStatusCodes ?? [408, 409, 425, 429, 500, 502, 503, 504],
    maxRetryAfterMs: Math.max(0, policy.maxRetryAfterMs ?? 30_000),
  };
}

function retryAfterDelayMs(
  response: Response,
  policy: NormalizedRetryPolicy,
  now: () => number,
): number | undefined {
  if (policy.maxRetryAfterMs <= 0) {
    return undefined;
  }

  const header = response.headers?.get('retry-after');

  if (!header) {
    return undefined;
  }

  const seconds = Number(header);
  const delayMs = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(header) - now();

  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return undefined;
  }

  return Math.min(delayMs, policy.maxRetryAfterMs);
}

function createCircuitBreakerState(value: boolean | CircuitBreakerPolicy | undefined): MutableCircuitBreakerState {
  if (value === false) {
    return {
      status: 'closed',
      failureCount: 0,
      failureThreshold: Number.POSITIVE_INFINITY,
      resetTimeoutMs: 0,
      enabled: false,
    };
  }

  const policy = typeof value === 'object' && value ? value : {};

  return {
    status: 'closed',
    failureCount: 0,
    failureThreshold: Math.max(1, policy.failureThreshold ?? 5),
    resetTimeoutMs: Math.max(0, policy.resetTimeoutMs ?? 30_000),
    enabled: true,
  };
}

function assertCircuitAllowsRequest(
  circuit: MutableCircuitBreakerState,
  now: () => number,
  operationName: string,
): void {
  if (!circuit.enabled || circuit.status !== 'open') {
    return;
  }

  const openedAt = circuit.openedAt ?? 0;

  if (now() - openedAt >= circuit.resetTimeoutMs) {
    circuit.status = 'half-open';
    return;
  }

  throw new Error(`Circuit breaker is open for ${operationName}`);
}

function recordCircuitSuccess(circuit: MutableCircuitBreakerState): void {
  if (!circuit.enabled) {
    return;
  }

  circuit.status = 'closed';
  circuit.failureCount = 0;
  circuit.openedAt = undefined;
}

function recordCircuitFailure(circuit: MutableCircuitBreakerState, now: () => number): void {
  if (!circuit.enabled) {
    return;
  }

  circuit.failureCount += 1;

  if (circuit.failureCount >= circuit.failureThreshold) {
    circuit.status = 'open';
    circuit.openedAt = now();
  }
}

function retryDelayMs(
  policy: NormalizedRetryPolicy,
  attempt: number,
  random: () => number,
): number {
  const base = Math.min(
    policy.maxDelayMs,
    policy.initialDelayMs * (policy.backoffFactor ** Math.max(0, attempt - 1)),
  );

  if (!policy.jitter || base === 0) {
    return base;
  }

  return Math.floor(base * (0.5 + random()));
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
