import { describe, expect, it } from 'vitest';
import { createHttpReq } from '../index.js';

describe('createHttpReq', () => {
  it('retries retryable HTTP responses with backoff', async () => {
    const delays: number[] = [];
    let attempts = 0;
    const http = createHttpReq({
      retry: {
        maxAttempts: 3,
        initialDelayMs: 10,
        backoffFactor: 2,
        jitter: false,
      },
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    const response = await http.request(async () => {
      attempts += 1;

      if (attempts < 3) {
        return Response.json({ error: 'busy' }, { status: 503 });
      }

      return Response.json({ ok: true });
    }, 'https://api.example.test');

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(attempts).toBe(3);
    expect(delays).toEqual([10, 20]);
    expect(http.getCircuitState()).toMatchObject({
      status: 'closed',
      failureCount: 0,
    });
  });

  it('opens the circuit after repeated exhausted retry attempts', async () => {
    let now = 1_000;
    let attempts = 0;
    const http = createHttpReq({
      operationName: 'github issue create',
      retry: {
        maxAttempts: 2,
        initialDelayMs: 0,
      },
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeoutMs: 500,
      },
      now: () => now,
      sleep: async () => {},
    });
    const fetchImpl = async () => {
      attempts += 1;
      return Response.json({ error: 'busy' }, { status: 503 });
    };

    expect((await http.request(fetchImpl, 'https://api.example.test')).status).toBe(503);
    expect((await http.request(fetchImpl, 'https://api.example.test')).status).toBe(503);
    expect(http.getCircuitState()).toMatchObject({
      status: 'open',
      failureCount: 2,
      openedAt: 1_000,
    });

    await expect(http.request(fetchImpl, 'https://api.example.test'))
      .rejects.toThrow('Circuit breaker is open for github issue create');
    expect(attempts).toBe(4);

    now = 1_501;
    await expect(http.request(async () => Response.json({ ok: true }), 'https://api.example.test'))
      .resolves.toMatchObject({ ok: true });
    expect(http.getCircuitState()).toMatchObject({
      status: 'closed',
      failureCount: 0,
    });
  });

  it('honors Retry-After seconds on retryable responses', async () => {
    const delays: number[] = [];
    let attempts = 0;
    const http = createHttpReq({
      retry: { maxAttempts: 2, initialDelayMs: 10, jitter: false },
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    const response = await http.request(async () => {
      attempts += 1;

      if (attempts === 1) {
        return Response.json({ error: 'rate limited' }, {
          status: 429,
          headers: { 'retry-after': '3' },
        });
      }

      return Response.json({ ok: true });
    }, 'https://api.example.test');

    expect(response.status).toBe(200);
    expect(delays).toEqual([3_000]);
  });

  it('honors Retry-After HTTP dates and caps the wait at maxRetryAfterMs', async () => {
    const delays: number[] = [];
    let attempts = 0;
    const now = Date.parse('2026-06-12T00:00:00Z');
    const http = createHttpReq({
      retry: { maxAttempts: 2, initialDelayMs: 10, jitter: false, maxRetryAfterMs: 5_000 },
      now: () => now,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    await http.request(async () => {
      attempts += 1;

      if (attempts === 1) {
        return Response.json({ error: 'overloaded' }, {
          status: 503,
          headers: { 'retry-after': new Date(now + 120_000).toUTCString() },
        });
      }

      return Response.json({ ok: true });
    }, 'https://api.example.test');

    expect(delays).toEqual([5_000]);
  });

  it('falls back to backoff when Retry-After is missing or invalid', async () => {
    const delays: number[] = [];
    let attempts = 0;
    const http = createHttpReq({
      retry: { maxAttempts: 3, initialDelayMs: 10, backoffFactor: 2, jitter: false },
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    await http.request(async () => {
      attempts += 1;

      if (attempts === 1) {
        return Response.json({ error: 'busy' }, {
          status: 503,
          headers: { 'retry-after': 'not-a-date' },
        });
      }

      if (attempts === 2) {
        return Response.json({ error: 'busy' }, { status: 503 });
      }

      return Response.json({ ok: true });
    }, 'https://api.example.test');

    expect(delays).toEqual([10, 20]);
  });
});
