import type { DeploymentDefinition } from '@fdekit/core';
import { describe, expect, it } from 'vitest';
import { runConnectorReadinessChecks } from '../commands/doctor.js';

function deploymentWith(connectors: Record<string, unknown>): DeploymentDefinition {
  return { name: 'test', environment: 'local', connectors } as unknown as DeploymentDefinition;
}

describe('runConnectorReadinessChecks', () => {
  it('collects checks from connectors that expose a readiness probe, tagged by owner', async () => {
    const deployment = deploymentWith({
      codebase: {
        name: 'codebase',
        readiness: async () => [
          { name: 'tree-sitter', ok: true, message: 'grammars loaded', latencyMs: 5 },
          { name: 'ripgrep', ok: true, message: 'binary present' },
        ],
      },
      github: { name: 'github' },
    });

    await expect(runConnectorReadinessChecks(deployment)).resolves.toEqual([
      { owner: 'codebase', name: 'tree-sitter', ok: true, message: 'grammars loaded', latencyMs: 5 },
      { owner: 'codebase', name: 'ripgrep', ok: true, message: 'binary present' },
    ]);
  });

  it('reports a warning instead of throwing when a readiness probe fails', async () => {
    const deployment = deploymentWith({
      codebase: {
        name: 'codebase',
        readiness: () => {
          throw new Error('boom');
        },
      },
    });

    await expect(runConnectorReadinessChecks(deployment)).resolves.toEqual([
      { owner: 'codebase', name: 'readiness', ok: false, message: 'readiness probe failed - boom' },
    ]);
  });

  it('skips connectors without a readiness probe', async () => {
    const deployment = deploymentWith({ github: { name: 'github' }, slack: { name: 'slack' } });

    await expect(runConnectorReadinessChecks(deployment)).resolves.toEqual([]);
  });
});
