import { describe, expect, it } from 'vitest';
import {
  expectedFinalAnswer,
  expectedToolCall,
  maxCost,
  maxLatency,
  noPolicyViolation,
  notExpectedToolCall,
} from '../index.js';

describe('eval assertions', () => {
  it('checks expected tool calls', async () => {
    const assertion = expectedToolCall('ticket.get');

    expect(await assertion.evaluate({
      toolCalls: [{ name: 'ticket.get' }],
    })).toMatchObject({ passed: true });

    expect(await assertion.evaluate({
      toolCalls: [{ name: 'customer.get' }],
    })).toMatchObject({ passed: false });
  });

  it('checks absent tool calls', async () => {
    const assertion = notExpectedToolCall('ticket.escalate');

    expect(await assertion.evaluate({
      toolCalls: [{ name: 'ticket.get' }],
    })).toMatchObject({ passed: true });

    expect(await assertion.evaluate({
      toolCalls: [{ name: 'ticket.escalate' }],
    })).toMatchObject({ passed: false });
  });

  it('checks final answers by string, regex, and predicate', async () => {
    expect(await expectedFinalAnswer('escalated').evaluate({
      finalAnswer: 'Ticket was escalated',
    })).toMatchObject({ passed: true });

    expect(await expectedFinalAnswer(/renewal/i).evaluate({
      finalAnswer: 'Renewal risk detected',
    })).toMatchObject({ passed: true });

    expect(await expectedFinalAnswer((answer) => answer.length > 10).evaluate({
      finalAnswer: 'short',
    })).toMatchObject({ passed: false });
  });

  it('checks latency and cost budgets', async () => {
    expect(await maxLatency(100).evaluate({ latencyMs: 99 })).toMatchObject({ passed: true });
    expect(await maxLatency(100).evaluate({ latencyMs: 101 })).toMatchObject({ passed: false });

    expect(await maxCost(0.25).evaluate({ costUsd: 0.2 })).toMatchObject({ passed: true });
    expect(await maxCost(0.25).evaluate({ costUsd: 0.3 })).toMatchObject({ passed: false });
  });

  it('checks policy violations', async () => {
    expect(await noPolicyViolation().evaluate({
      policyViolations: [],
    })).toMatchObject({ passed: true });

    expect(await noPolicyViolation().evaluate({
      policyViolations: [{ policy: 'deny-pii-leak', reason: 'Potential PII detected' }],
    })).toMatchObject({ passed: false });
  });
});
