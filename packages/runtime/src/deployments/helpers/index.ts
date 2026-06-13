import type { AnyToolDefinition, DeploymentDefinition } from '@fdekit/core';
import type {
  DeploymentDiffChange,
  DeploymentValidationOptions,
  DeploymentValidationSeverity,
  SnapshotAgent,
  SnapshotArtifactStore,
  SnapshotConnector,
  SnapshotEval,
  SnapshotGovernance,
  SnapshotProvider,
  SnapshotTool,
} from '../interfaces/index.js';

export function validateTool(
  tool: AnyToolDefinition,
  path: string,
  add: (severity: DeploymentValidationSeverity, path: string, message: string) => void,
  options: DeploymentValidationOptions = {},
): void {
  if (!tool.name) {
    add('error', `${path}.name`, 'Tool must declare a name');
  }

  if (typeof tool.handler !== 'function') {
    add('error', `${path}.handler`, 'Tool must declare a handler function');
  }

  if (!tool.argsSchema) {
    const severity = options.strict || options.requireToolArgsSchema ? 'error' : 'warning';
    add(severity, `${path}.argsSchema`, 'Tool does not declare argsSchema; model calls may be less reliable');
  }

  if (!tool.scopes || tool.scopes.length === 0) {
    add(options.strict ? 'error' : 'warning', `${path}.scopes`, 'Tool does not declare permission scopes');
  }

  if (!tool.environments || tool.environments.length === 0) {
    add(options.strict ? 'error' : 'warning', `${path}.environments`, 'Tool does not declare allowed environments');
  }
}

export function snapshotProviders(deployment: DeploymentDefinition): Record<string, SnapshotProvider> {
  return sortedEntries(deployment.providers ?? {}).reduce<Record<string, SnapshotProvider>>((acc, [key, provider]) => {
    acc[key] = {
      name: provider.name,
      model: provider.model,
      apiKeyEnv: provider.apiKeyEnv,
      env: (provider.env ?? []).map((requirement) => requirement.name).sort(),
      options: sortObject(stripUndefined(provider.options ?? {})),
    };

    return acc;
  }, {});
}

export function snapshotConnectors(deployment: DeploymentDefinition): Record<string, SnapshotConnector> {
  return sortedEntries(deployment.connectors ?? {}).reduce<Record<string, SnapshotConnector>>((acc, [key, connector]) => {
    acc[key] = {
      name: connector.name,
      env: (connector.env ?? []).map((requirement) => requirement.name).sort(),
      tools: (connector.tools ?? []).reduce<Record<string, SnapshotTool>>((tools, tool) => {
        tools[tool.name] = snapshotTool(tool);
        return tools;
      }, {}),
    };

    acc[key].tools = sortObject(acc[key].tools) as Record<string, SnapshotTool>;
    return acc;
  }, {});
}

export function snapshotAgents(deployment: DeploymentDefinition): Record<string, SnapshotAgent> {
  return sortedEntries(deployment.agents ?? {}).reduce<Record<string, SnapshotAgent>>((acc, [key, agent]) => {
    acc[key] = {
      provider: agent.provider ?? 'mock',
      model: agent.model,
      instructions: agent.instructions,
      tools: (agent.tools ?? []).map((tool) => tool.name).sort(),
      policies: (agent.policies ?? []).map((policy) => policy.name).sort(),
      evals: (agent.evals ?? []).map((evalDefinition) => evalDefinition.name).sort(),
      harness: agent.harness,
    };

    return acc;
  }, {});
}

export function snapshotGovernance(deployment: DeploymentDefinition): SnapshotGovernance | undefined {
  const governance = deployment.governance;

  if (!governance) {
    return undefined;
  }

  return {
    auditEnabled: governance.audit?.enabled,
    allowedEnvironments: [...(governance.environments?.allowed ?? [])].sort(),
    deniedEnvironments: [...(governance.environments?.denied ?? [])].sort(),
    environmentTools: [...(governance.environments?.tools ?? [])].sort(),
    budgetCaps: (governance.budgets ?? []).map((budget) => ({
      scope: budget.scope,
      maxUsd: budget.maxUsd,
    })),
    allowedScopes: [...(governance.permissions?.allowedScopes ?? [])].sort(),
    deniedScopes: [...(governance.permissions?.deniedScopes ?? [])].sort(),
    requireScopes: governance.permissions?.requireScopes,
    denyPII: Boolean(governance.dataProtection?.denyPII),
    redactSecrets: Boolean(governance.dataProtection?.redactSecrets),
  };
}

export function snapshotArtifacts(deployment: DeploymentDefinition): SnapshotArtifactStore | undefined {
  const artifacts = deployment.artifacts;

  if (!artifacts) {
    return undefined;
  }

  if (artifacts.kind === 's3') {
    return {
      kind: 's3',
      bucket: artifacts.bucket,
      prefix: artifacts.prefix,
      region: artifacts.region,
    };
  }

  return {
    kind: 'local',
    rootDir: artifacts.rootDir,
  };
}

export function snapshotEvals(deployment: DeploymentDefinition): Record<string, SnapshotEval> {
  return (deployment.evals ?? []).reduce<Record<string, SnapshotEval>>((acc, evalDefinition) => {
    acc[evalDefinition.name] = {
      version: evalDefinition.version,
      agent: evalDefinition.agent,
      dataset: evalDefinition.dataset,
      maxSteps: evalDefinition.maxSteps,
      cases: (evalDefinition.cases ?? []).map((testCase) => testCase.name).sort(),
      assertions: (evalDefinition.assertions ?? []).map((assertion) => assertion.name).sort(),
    };

    return acc;
  }, {});
}

function snapshotTool(tool: AnyToolDefinition): SnapshotTool {
  return {
    description: tool.description,
    category: tool.category,
    tags: [...(tool.tags ?? [])].sort(),
    scopes: [...(tool.scopes ?? [])].sort(),
    environments: [...(tool.environments ?? [])].sort(),
    hasArgsSchema: Boolean(tool.argsSchema),
  };
}



export function diffValues(
  before: unknown,
  after: unknown,
  path: string[],
  changes: DeploymentDiffChange[],
): void {
  if (stableStringify(before) === stableStringify(after)) {
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const maxLength = Math.max(before.length, after.length);

    for (let index = 0; index < maxLength; index += 1) {
      const beforeHas = index < before.length;
      const afterHas = index < after.length;
      const indexPath = [...path, String(index)];

      if (!beforeHas) {
        changes.push({ kind: 'added', path: formatPath(indexPath), after: after[index] });
      } else if (!afterHas) {
        changes.push({ kind: 'removed', path: formatPath(indexPath), before: before[index] });
      } else {
        diffValues(before[index], after[index], indexPath, changes);
      }
    }

    return;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();

    for (const key of keys) {
      const beforeHas = Object.prototype.hasOwnProperty.call(before, key);
      const afterHas = Object.prototype.hasOwnProperty.call(after, key);

      if (!beforeHas) {
        changes.push({ kind: 'added', path: formatPath([...path, key]), after: after[key] });
      } else if (!afterHas) {
        changes.push({ kind: 'removed', path: formatPath([...path, key]), before: before[key] });
      } else {
        diffValues(before[key], after[key], [...path, key], changes);
      }
    }

    return;
  }

  changes.push({
    kind: 'changed',
    path: formatPath(path),
    before,
    after,
  });
}

function sortedEntries<T>(record: Record<string, T>): Array<[string, T]> {
  return Object.entries(record).sort(([left], [right]) => left.localeCompare(right));
}

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

export function stripUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, stripUndefinedDeep(entry)]));
  }

  return value;
}

function sortObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(sortedEntries(value).map(([key, entry]) => [
    key,
    isPlainObject(entry) ? sortObject(entry) : entry,
  ]));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

function formatPath(path: string[]): string {
  return path.length > 0 ? path.join('.') : 'deployment';
}
