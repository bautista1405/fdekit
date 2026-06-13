import type { DeploymentDefinition } from '@fdekit/core';
import type { TraceArtifact } from './traces/index.js';

export function createDevTrace(deployment: DeploymentDefinition): TraceArtifact {
  return {
    id: `trace_${Date.now()}`,
    createdAt: new Date().toISOString(),
    deployment: deployment.name,
    events: [
      {
        type: 'deployment.loaded',
        message: `Loaded deployment ${deployment.name}`,
        providers: Object.keys(deployment.providers ?? {}),
        connectors: Object.keys(deployment.connectors ?? {}),
        agents: Object.keys(deployment.agents ?? {}),
      },
      ...Object.keys(deployment.agents ?? {}).map((agentName) => ({
        type: 'agent.ready',
        agent: agentName,
        message: `Agent ${agentName} is ready for local development`,
      })),
    ],
  };
}
