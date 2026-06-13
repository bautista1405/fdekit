import type { HarnessDefinition, HarnessPhaseDefinition } from '@fdekit/core';
import type {
  CompiledHarnessPhasePlan,
  CompiledHarnessPlan,
  CompiledPlanReference,
} from '../interfaces/index.js';
import type { KnownRefs } from './shared.js';

export function compileHarness(harness: HarnessDefinition, knownRefs: KnownRefs): CompiledHarnessPlan {
  return {
    name: harness.name,
    version: harness.version,
    description: harness.description,
    maxSteps: harness.maxSteps,
    toolRefs: resolveRefs(harness.toolRefs ?? [], knownRefs.tools),
    policyRefs: resolveRefs(harness.policyRefs ?? [], knownRefs.policies),
    evalRefs: resolveRefs(harness.evalRefs ?? [], knownRefs.evals),
    artifactRefs: [...(harness.artifactRefs ?? [])].sort(),
    phases: harness.phases.map((phase) => compileHarnessPhase(phase, knownRefs)),
    review: harness.review
      ? {
        evalRefs: resolveRefs(harness.review.evalRefs ?? [], knownRefs.evals),
        artifactRefs: [...(harness.review.artifactRefs ?? [])].sort(),
        adversarial: harness.review.adversarial,
      }
      : undefined,
    steer: harness.steer
      ? {
        enabled: harness.steer.enabled,
        maxAttempts: harness.steer.maxAttempts,
        triggerRefs: resolveTriggerRefs(harness.steer.triggerRefs ?? [], knownRefs),
      }
      : undefined,
  };
}

function compileHarnessPhase(
  phase: HarnessPhaseDefinition,
  knownRefs: KnownRefs,
): CompiledHarnessPhasePlan {
  return {
    name: phase.name,
    description: phase.description,
    maxSteps: phase.maxSteps,
    humanOwner: phase.humanOwner,
    toolRefs: resolveRefs(phase.toolRefs ?? [], knownRefs.tools),
    optionalToolRefs: resolveRefs(phase.optionalToolRefs ?? [], knownRefs.tools),
    policyRefs: resolveRefs(phase.policyRefs ?? [], knownRefs.policies),
    evalRefs: resolveRefs(phase.evalRefs ?? [], knownRefs.evals),
    artifactRefs: [...(phase.artifactRefs ?? [])].sort(),
  };
}

function resolveRefs(refs: string[], known: Map<string, string>): CompiledPlanReference[] {
  return refs.map((name) => ({
    name,
    status: known.has(name) ? 'resolved' : 'missing',
    source: known.get(name),
  }));
}

function resolveTriggerRefs(refs: string[], knownRefs: KnownRefs): CompiledPlanReference[] {
  return refs.map((name) => {
    const source = knownRefs.policies.get(name) ?? knownRefs.evals.get(name);

    return {
      name,
      status: source ? 'resolved' : 'missing',
      source,
    };
  });
}
