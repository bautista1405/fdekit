import type { DeploymentDefinition } from '@fdekit/core';

/**
 * Connector config keys that identify the execution target of a tool call.
 * `mode` distinguishes simulated from live connectors; the remaining keys pin
 * the external system the write lands on (repository, channel, base URL, ...).
 * Credential-shaped config (tokens, env var names) is deliberately excluded.
 */
const TARGET_IDENTITY_KEYS = [
  'mode',
  'apiBaseUrl',
  'baseUrl',
  'instanceUrl',
  'repository',
  'defaultChannel',
  'channel',
  'portalId',
  'teamId',
  'projectKey',
  'issueType',
  'apiVersion',
  'rootDir',
  'database',
] as const;

/**
 * Maps every connector-provided tool name to the target identity of its
 * connector, so approval fingerprints are scoped to where the call executes.
 */
export function collectToolTargets(deployment: DeploymentDefinition): Map<string, Record<string, unknown>> {
  const targets = new Map<string, Record<string, unknown>>();

  for (const connector of Object.values(deployment.connectors ?? {})) {
    const target = connectorTargetIdentity(connector.name, connector.config);

    for (const tool of connector.tools ?? []) {
      targets.set(tool.name, target);
    }
  }

  return targets;
}

function connectorTargetIdentity(
  connectorName: string,
  config: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const target: Record<string, unknown> = { connector: connectorName };

  for (const key of TARGET_IDENTITY_KEYS) {
    const value = config?.[key];

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      target[key] = value;
    }
  }

  return target;
}
