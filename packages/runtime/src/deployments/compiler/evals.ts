import type { DeploymentDefinition, EvalDefinition } from '@fdekit/core';
import type { CompiledEvalPlan } from '../interfaces/index.js';
import { sortedEntries, sortObject } from './shared.js';

export function compileEvals(deployment: DeploymentDefinition): Record<string, CompiledEvalPlan> {
  const evals: Record<string, CompiledEvalPlan> = {};

  for (const evalDefinition of deployment.evals ?? []) {
    evals[`deployment:${evalDefinition.name}`] = compileEval(evalDefinition, 'deployment');
  }

  for (const [agentName, agent] of sortedEntries(deployment.agents ?? {})) {
    for (const evalDefinition of agent.evals ?? []) {
      evals[`agent:${agentName}:${evalDefinition.name}`] = compileEval(evalDefinition, `agent:${agentName}`, agentName);
    }
  }

  return sortObject(evals);
}

function compileEval(
  evalDefinition: EvalDefinition,
  scope: CompiledEvalPlan['scope'],
  defaultAgent?: string,
): CompiledEvalPlan {
  return {
    name: evalDefinition.name,
    scope,
    agent: evalDefinition.agent ?? defaultAgent,
    dataset: evalDefinition.dataset,
    caseCount: evalDefinition.cases?.length ?? 0,
    assertionCount: evalDefinition.assertions?.length ?? 0,
    hasCustomRunner: typeof evalDefinition.run === 'function',
    maxSteps: evalDefinition.maxSteps,
  };
}

export function evalNamesForAgent(evals: Record<string, CompiledEvalPlan>, agentName: string): string[] {
  return Object.values(evals)
    .filter((evalPlan) => evalPlan.scope === `agent:${agentName}` || evalPlan.agent === agentName)
    .map((evalPlan) => evalPlan.name)
    .sort();
}
