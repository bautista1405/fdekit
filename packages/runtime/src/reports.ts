import type { DeploymentDefinition } from '@fdekit/core';
import { collectEvals, type EvalArtifact } from './evals/index.js';
import type { TraceArtifact } from './traces/index.js';
import { joinNames } from './utils.js';

export function renderReport(
  deployment: DeploymentDefinition,
  latestEval: EvalArtifact | null,
  traces: TraceArtifact[],
): string {
  const providerNames = Object.keys(deployment.providers ?? {});
  const connectorNames = Object.keys(deployment.connectors ?? {});
  const agentNames = Object.keys(deployment.agents ?? {});

  return `# ${deployment.name} Deployment Report

Created: ${new Date().toISOString()}

## Summary

- Environment: ${deployment.environment ?? 'local'}
- Providers: ${joinNames(providerNames)}
- Connectors: ${joinNames(connectorNames)}
- Agents: ${joinNames(agentNames)}

## Governance

- Deployment policies: ${(deployment.policies ?? []).map((policy) => policy.name).join(', ') || 'none'}
- Evals configured: ${collectEvals(deployment).length}

## Latest Eval

- Status: ${latestEval?.status ?? 'not run'}
- Suites: ${latestEval?.results?.length ?? 0}

## Observability

- Traces captured: ${traces.length}
- Latest trace: ${traces.length > 0 ? traces[traces.length - 1]?.id ?? 'none' : 'none'}
`;
}
