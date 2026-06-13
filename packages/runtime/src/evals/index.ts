import type {
  DeploymentDefinition,
  EvalAssertionResult,
} from '@fdekit/core';
import { createArtifactStore } from '../artifact-store/index.js';
import type { EvalArtifact, EvalCaseResult, EvalSuiteResult, LoadedEval, RunEvalsOptions } from './interfaces/index.js';
export type { EvalArtifact, EvalCaseResult, EvalSuiteResult, LoadedEval, RunEvalsOptions } from './interfaces/index.js';

import { agentNameFromScope, createEvalId, loadEvalCases, runAgentEvalCase } from './helpers/index.js';
export function collectEvals(deployment: DeploymentDefinition): LoadedEval[] {
  const evals: LoadedEval[] = [];

  for (const evalDefinition of deployment.evals ?? []) {
    evals.push({
      scope: 'deployment',
      name: evalDefinition.name ?? 'unnamed-eval',
      definition: evalDefinition,
    });
  }

  for (const [agentName, agent] of Object.entries(deployment.agents ?? {})) {
    for (const evalDefinition of agent.evals ?? []) {
      evals.push({
        scope: `agent:${agentName}`,
        name: evalDefinition.name ?? 'unnamed-eval',
        definition: evalDefinition,
      });
    }
  }

  return evals;
}

export async function runEval(evalItem: LoadedEval, options: RunEvalsOptions): Promise<EvalSuiteResult> {
  const definition = evalItem.definition;
  const assertionResults: EvalAssertionResult[] = [];

  if (typeof definition.run === 'function') {
    const value = await definition.run(options.deployment);

    return {
      scope: evalItem.scope,
      name: evalItem.name,
      status: value === false ? 'failed' : 'passed',
      result: value,
    };
  }

  const cases = await loadEvalCases(definition, options.projectDir);
  const agentName = definition.agent ?? agentNameFromScope(evalItem.scope);

  if (cases.length > 0 && agentName) {
    const caseResults = [];

    for (const evalCase of cases) {
      caseResults.push(await runAgentEvalCase(evalItem, evalCase, agentName, options));
    }

    const passed = caseResults.every((result) => result.status === 'passed');

    return {
      scope: evalItem.scope,
      name: evalItem.name,
      status: passed ? 'passed' : 'failed',
      cases: caseResults,
    };
  }

  for (const assertion of definition.assertions ?? []) {
    assertionResults.push(await assertion.evaluate({
      deploymentName: options.deployment.name,
      policyViolations: [],
      latencyMs: 0,
      costUsd: 0,
      toolCalls: [],
    }));
  }

  for (const evalCase of cases) {
    for (const assertion of evalCase.assertions ?? []) {
      assertionResults.push(await assertion.evaluate({
        deploymentName: options.deployment.name,
        input: evalCase.input,
        expected: evalCase.expected,
        policyViolations: [],
        latencyMs: 0,
        costUsd: 0,
        toolCalls: [],
      }));
    }
  }

  const passed = assertionResults.every((result) => result.passed);

  return {
    scope: evalItem.scope,
    name: evalItem.name,
    status: passed ? 'passed' : 'failed',
    assertions: assertionResults,
  };
}

export async function runEvals(options: RunEvalsOptions): Promise<EvalArtifact> {
  const evals = collectEvals(options.deployment);
  const runOptions: RunEvalsOptions = {
    ...options,
    artifactStore: createArtifactStore({
      deployment: options.deployment,
      projectDir: options.projectDir,
      store: options.artifactStore,
    }),
  };
  const results = [];

  for (const evalItem of evals) {
    results.push(await runEval(evalItem, runOptions));
  }

  const passed = results.every((result) => result.status === 'passed');

  return {
    id: createEvalId(),
    createdAt: new Date().toISOString(),
    deployment: runOptions.deployment.name,
    status: passed ? 'passed' : 'failed',
    results,
  };
}
