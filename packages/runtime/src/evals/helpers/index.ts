import { promises as fs } from 'fs';
import * as path from 'path';
import {
  asOptionalRecord,
  asRecord,
  type EvalAssertion,
  type EvalAssertionResult,
  type EvalCase,
  type EvalDefinition,
} from '@fdekit/core';
import { writeJsonArtifact } from '../../artifact-store/index.js';
import { AgentRunError, runAgent, type AgentRunResult } from '../../agents/index.js';
import {
  buildToolMetadataIndex,
  TOOL_SEMANTICS,
  toolCallsWithSemantic,
  toolNamesWithSemantic,
  type ToolMetadataIndex,
} from '../../tool-metadata.js';
import type { EvalCaseResult, LoadedEval, RunEvalsOptions } from '../interfaces/index.js';

let evalIdCounter = 0;

interface MaterializedEvalCase extends EvalCase {
  input: Record<string, unknown>;
  expected?: Record<string, unknown>;
}


export function createEvalId(): string {
  evalIdCounter += 1;
  return `eval_${Date.now()}_${evalIdCounter}`;
}

export async function runAgentEvalCase(
  evalItem: LoadedEval,
  evalCase: MaterializedEvalCase,
  agentName: string,
  options: RunEvalsOptions,
): Promise<EvalCaseResult> {
  try {
    const runResult = await runAgent({
      deployment: options.deployment,
      projectDir: options.projectDir,
      agentName,
      input: evalCase.input,
      maxSteps: evalItem.definition.maxSteps,
      providerRegistry: options.providerRegistry,
      artifactStore: options.artifactStore,
    });

    if (options.writeTraces) {
      await writeJsonArtifact(options.projectDir, 'traces', `${runResult.trace.id}.json`, runResult.trace, options.artifactStore);
    }

    const toolMetadata = buildToolMetadataIndex(options.deployment);
    const configuredAssertions = evalItem.definition.assertions ?? [];
    const assertions = await evaluateRunAssertions(configuredAssertions, evalCase, runResult);
    assertions.push(...evaluateExpectedBehavior(
      evalCase,
      runResult,
      toolMetadata,
      !configuredAssertions.some((assertion) => assertion.name === 'expected-approval-outcome'),
    ));

    const status = assertions.every((result) => result.passed) ? 'passed' : 'failed';

    return {
      name: evalCase.name,
      status,
      input: evalCase.input,
      expected: evalCase.expected,
      metadata: evalCase.metadata,
      finalAnswer: runResult.finalAnswer,
      toolCalls: runResult.toolCalls.map((call) => call.name),
      traceId: runResult.trace.id,
      assertions,
    };
  } catch (err) {
    if (err instanceof AgentRunError && options.writeTraces) {
      await writeJsonArtifact(
        options.projectDir,
        'traces',
        `${err.result.trace.id}.json`,
        err.result.trace,
        options.artifactStore,
      );
    }

    return {
      name: evalCase.name,
      status: 'failed',
      input: evalCase.input,
      expected: evalCase.expected,
      metadata: evalCase.metadata,
      toolCalls: err instanceof AgentRunError
        ? err.result.toolCalls.map((call) => call.name)
        : [],
      traceId: err instanceof AgentRunError ? err.result.trace.id : undefined,
      assertions: [
        {
          passed: false,
          message: err instanceof Error ? err.message : String(err),
          score: 0,
        },
      ],
    };
  }
}

async function evaluateRunAssertions(
  assertions: EvalAssertion[],
  evalCase: MaterializedEvalCase,
  runResult: AgentRunResult,
): Promise<EvalAssertionResult[]> {
  const results = [];

  for (const assertion of assertions) {
    results.push(await assertion.evaluate({
      deploymentName: runResult.deployment,
      agentName: runResult.agent,
      input: evalCase.input,
      expected: evalCase.expected,
      output: runResult,
      finalAnswer: runResult.finalAnswer,
      toolCalls: runResult.toolCalls,
      policyViolations: runResult.policyViolations,
      costUsd: runResult.costUsd,
      latencyMs: runResult.latencyMs,
      metadata: {
        traceId: runResult.trace.id,
      },
    }));
  }

  return results;
}

function evaluateExpectedBehavior(
  evalCase: MaterializedEvalCase,
  runResult: AgentRunResult,
  toolMetadata: ToolMetadataIndex,
  includeApprovalOutcome: boolean,
): EvalAssertionResult[] {
  const expected = evalCase.expected ?? {};
  const results: EvalAssertionResult[] = [];

  if ('escalation' in expected) {
    const expectedEscalation = expected.escalation === true;
    const escalationTools = toolNamesWithSemantic(toolMetadata, TOOL_SEMANTICS.escalation);
    const observed = new Set(runResult.toolCalls.map((call) => call.name));
    const observedEscalationTools = toolCallsWithSemantic([...observed], toolMetadata, TOOL_SEMANTICS.escalation);
    const passed = expectedEscalation
      ? escalationTools.length > 0 && escalationTools.every((toolName) => observed.has(toolName))
      : observedEscalationTools.length === 0;

    results.push({
      passed,
      message: expectedEscalation
        ? 'Expected escalation tools to be called'
        : 'Expected escalation tools not to be called',
      score: passed ? 1 : 0,
      metadata: {
        expected: expectedEscalation,
        requiredTools: expectedEscalation ? escalationTools : [],
        forbiddenTools: expectedEscalation ? [] : escalationTools,
        observedTools: [...observed],
        observedEscalationTools,
      },
    });
  }

  if (
    includeApprovalOutcome
    && typeof expected.toolName === 'string'
    && typeof expected.shouldProceed === 'boolean'
  ) {
    const observedTools = runResult.toolCalls.map((call) => call.name);
    const observed = observedTools.includes(expected.toolName);
    const passed = expected.shouldProceed ? observed : !observed;

    results.push({
      passed,
      message: expected.shouldProceed
        ? `Expected approved tool "${expected.toolName}" to proceed`
        : `Expected rejected tool "${expected.toolName}" not to proceed`,
      score: passed ? 1 : 0,
      metadata: {
        toolName: expected.toolName,
        shouldProceed: expected.shouldProceed,
        observed,
        observedTools,
      },
    });
  }

  for (const key of ['customerId', 'priority', 'issueType'] as const) {
    if (typeof expected[key] !== 'string') {
      continue;
    }

    const needle = expected[key].toLowerCase();
    const passed = stringifyForSearch(runResult).toLowerCase().includes(needle);

    results.push({
      passed,
      message: `Expected run evidence to include ${key}: ${expected[key]}`,
      score: passed ? 1 : 0,
      metadata: {
        key,
        expected: expected[key],
      },
    });
  }

  return results;
}

export async function loadEvalCases(definition: EvalDefinition, projectDir: string): Promise<MaterializedEvalCase[]> {
  const inlineCases = (definition.cases ?? []).map(materializeCase);

  if (!definition.dataset) {
    return inlineCases;
  }

  const datasetPath = path.resolve(projectDir, definition.dataset);
  const raw = JSON.parse(await fs.readFile(datasetPath, 'utf8')) as unknown;

  if (!Array.isArray(raw)) {
    throw new Error(`Eval dataset must be an array: ${datasetPath}`);
  }

  return [...inlineCases, ...raw.map(materializeCase)];
}

function materializeCase(value: unknown): MaterializedEvalCase {
  const record = asRecord(value);
  const input = asRecord(record.input);

  return {
    name: typeof record.name === 'string' ? record.name : 'unnamed-case',
    input,
    expected: asOptionalRecord(record.expected),
    assertions: Array.isArray(record.assertions) ? record.assertions as EvalAssertion[] : undefined,
    metadata: asOptionalRecord(record.metadata),
  };
}

export function agentNameFromScope(scope: string): string | undefined {
  return scope.startsWith('agent:') ? scope.slice('agent:'.length) : undefined;
}

function stringifyForSearch(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
