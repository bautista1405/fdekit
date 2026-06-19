import { describe, expect, it } from 'vitest';
import {
  expectedApprovalOutcome,
  expectedFinalAnswer,
  expectedToolCall,
  judgeRubric,
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

  it('checks approval outcomes from exported feedback expectations', async () => {
    const assertion = expectedApprovalOutcome();

    expect(await assertion.evaluate({
      expected: { toolName: 'issue.create', shouldProceed: true },
      toolCalls: [{ name: 'issue.create' }],
    })).toMatchObject({
      passed: true,
      message: 'Expected approved tool "issue.create" to proceed',
    });

    expect(await assertion.evaluate({
      expected: { toolName: 'issue.create', shouldProceed: false },
      toolCalls: [{ name: 'ticket.get' }],
    })).toMatchObject({
      passed: true,
      message: 'Expected rejected tool "issue.create" not to proceed',
    });

    expect(await assertion.evaluate({
      expected: {},
      toolCalls: [],
    })).toMatchObject({
      passed: false,
      message: 'expectedApprovalOutcome requires expected.toolName and expected.shouldProceed',
    });
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

  it('declares when a rubric judge is missing', async () => {
    const missingJudge = judgeRubric({
      rubric: 'Answer must be polite and complete.',
    });
    const configuredJudge = judgeRubric({
      rubric: 'Answer must be polite and complete.',
      judge: () => ({ passed: true, score: 1 }),
    });

    expect(missingJudge.configurationIssues).toEqual([{
      path: 'judge',
      message: 'judgeRubric requires a judge function; FDEKit does not provide a built-in provider-backed judge',
    }]);
    expect(await missingJudge.evaluate({ finalAnswer: 'Happy to help.' })).toMatchObject({
      passed: false,
      message: 'No judge function configured for rubric eval',
    });
    expect(configuredJudge.configurationIssues).toBeUndefined();
    expect(await configuredJudge.evaluate({ finalAnswer: 'Happy to help.' })).toMatchObject({
      passed: true,
      score: 1,
    });
  });
});
