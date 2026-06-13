import { asRecord, getString, parseEnvironmentEndpointConfigValue, resolveEnvironmentEndpoint } from '@fdekit/core';
import type {
  AnyToolDefinition,
  DeploymentDefinition,
  DeploymentEnvironmentDefinition,
  HarnessDefinition,
} from '@fdekit/core';

import { validateTool } from './helpers/index.js';
import type {
  DeploymentValidationIssue,
  DeploymentValidationOptions,
  DeploymentValidationResult,
  DeploymentValidationSeverity,
} from './interfaces/index.js';

export function validateDeployment(
  deployment: DeploymentDefinition,
  options: DeploymentValidationOptions = {},
): DeploymentValidationResult {
  const issues: DeploymentValidationIssue[] = [];
  const strict = options.strict === true;
  const validationOptions: DeploymentValidationOptions = {
    ...options,
    strict,
    requireToolArgsSchema: options.requireToolArgsSchema || strict,
  };
  const providers = deployment.providers ?? {};
  const connectors = deployment.connectors ?? {};
  const agents = deployment.agents ?? {};
  const evals = deployment.evals ?? [];
  const toolNames = new Map<string, string>();
  const policyNames = collectPolicyNames(deployment);
  const evalNames = collectEvalNames(deployment);

  const add = (severity: DeploymentValidationSeverity, path: string, message: string) => {
    issues.push({ severity, path, message });
  };

  if (!deployment.name || typeof deployment.name !== 'string') {
    add('error', 'name', 'Deployment must have a name');
  }

  if (Object.keys(providers).length === 0) {
    add('error', 'providers', 'Deployment must configure at least one provider');
  }

  if (Object.keys(agents).length === 0) {
    add('error', 'agents', 'Deployment must configure at least one agent');
  }

  for (const [providerKey, provider] of Object.entries(providers)) {
    if (!provider.name) {
      add('error', `providers.${providerKey}.name`, 'Provider must declare a name');
    }

    const envNames = new Set<string>();
    for (const requirement of provider.env ?? []) {
      if (!requirement.name) {
        add('error', `providers.${providerKey}.env`, 'Provider env requirements must declare names');
      } else if (envNames.has(requirement.name)) {
        add('warning', `providers.${providerKey}.env.${requirement.name}`, 'Provider env requirement is duplicated');
      }

      envNames.add(requirement.name);
    }
  }

  validateArtifactStore(deployment, add);
  validateEnvironmentWiring(deployment, add);

  for (const [connectorKey, connector] of Object.entries(connectors)) {
    if (!connector.name) {
      add('error', `connectors.${connectorKey}.name`, 'Connector must declare a name');
    }

    const tools = connector.tools ?? [];
    if (tools.length === 0) {
      add('warning', `connectors.${connectorKey}.tools`, 'Connector does not expose any tools yet');
    }

    for (const tool of tools) {
      validateTool(tool, `connectors.${connectorKey}.tools.${tool.name ?? '<unnamed>'}`, add, validationOptions);
      registerToolName(toolNames, tool, `connectors.${connectorKey}`, add);
    }
  }

  for (const [agentKey, agent] of Object.entries(agents)) {
    const providerName = agent.provider ?? 'mock';

    if (providerName !== 'mock' && !providers[providerName]) {
      add('error', `agents.${agentKey}.provider`, `Agent references missing provider "${providerName}"`);
    }

    if (!agent.instructions || typeof agent.instructions !== 'string') {
      add('error', `agents.${agentKey}.instructions`, 'Agent must declare instructions');
    }

    for (const tool of agent.tools ?? []) {
      validateTool(tool, `agents.${agentKey}.tools.${tool.name ?? '<unnamed>'}`, add, validationOptions);
      registerToolName(toolNames, tool, `agents.${agentKey}`, add);
    }

    if (agent.harness) {
      validateHarness(agent.harness, `agents.${agentKey}.harness`, toolNames, policyNames, evalNames, add);
    }
  }

  if (deployment.harness) {
    validateHarness(deployment.harness, 'harness', toolNames, policyNames, evalNames, add);
  }

  for (const [index, evalDefinition] of evals.entries()) {
    const evalPath = `evals.${evalDefinition.name || index}`;

    if (!evalDefinition.name) {
      add('error', evalPath, 'Eval must declare a name');
    }

    if (evalDefinition.agent && !agents[evalDefinition.agent]) {
      add('error', `${evalPath}.agent`, `Eval references missing agent "${evalDefinition.agent}"`);
    }

    if (evalDefinition.maxSteps !== undefined && (!Number.isInteger(evalDefinition.maxSteps) || evalDefinition.maxSteps <= 0)) {
      add('error', `${evalPath}.maxSteps`, 'Eval maxSteps must be a positive integer');
    }

    if (!evalDefinition.dataset && !evalDefinition.cases && !evalDefinition.run) {
      add('warning', evalPath, 'Eval has no dataset, inline cases, or custom run function');
    }
  }

  for (const [index, budget] of (deployment.governance?.budgets ?? []).entries()) {
    if (!Number.isFinite(budget.maxUsd) || budget.maxUsd <= 0) {
      add('error', `governance.budgets.${index}.maxUsd`, 'Budget maxUsd must be greater than zero');
    }
  }

  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
}

function validateEnvironmentWiring(
  deployment: DeploymentDefinition,
  add: (severity: DeploymentValidationSeverity, path: string, message: string) => void,
): void {
  const connectors = deployment.connectors ?? {};
  const declaredCustomerApiUrl = runtimeCustomerApiUrl(deployment.runtimeEnvironment);

  for (const [connectorKey, connector] of Object.entries(connectors)) {
    for (const [configKey, value] of Object.entries(asRecord(connector.config))) {
      const configValue = getString(value);
      const endpointName = configValue ? parseEnvironmentEndpointConfigValue(configValue) : undefined;

      if (!endpointName) {
        continue;
      }

      if (!deployment.runtimeEnvironment) {
        add(
          'error',
          `connectors.${connectorKey}.${configKey}`,
          `Connector references environment endpoint "${endpointName}" but the deployment has no runtimeEnvironment`,
        );
      } else if (!resolveEnvironmentEndpoint(endpointName, deployment.runtimeEnvironment)) {
        add(
          'error',
          `connectors.${connectorKey}.${configKey}`,
          `Connector references environment endpoint "${endpointName}" but the runtime environment does not export it`,
        );
      }
    }
  }

  if (declaredCustomerApiUrl) {
    for (const [connectorKey, connector] of Object.entries(connectors)) {
      if (connector.name !== 'customer-api') {
        continue;
      }

      const baseUrl = getString(asRecord(connector.config).baseUrl);

      if (baseUrl && parseEnvironmentEndpointConfigValue(baseUrl)) {
        continue;
      }

      if (baseUrl && normalizeUrlForComparison(baseUrl) !== normalizeUrlForComparison(declaredCustomerApiUrl)) {
        add(
          'warning',
          `connectors.${connectorKey}.baseUrl`,
          `Connector base URL "${baseUrl}" does not match the runtime environment customer API URL "${declaredCustomerApiUrl}"; agent tool calls and environment health checks target different endpoints`,
        );
      }
    }
  }

  if ((deployment.environment ?? 'local') !== 'local') {
    return;
  }

  for (const [connectorKey, connector] of Object.entries(connectors)) {
    const config = asRecord(connector.config);
    const mode = getString(config.mode);

    if (mode === 'api') {
      add(
        'warning',
        `connectors.${connectorKey}.mode`,
        'Connector runs in live "api" mode while the deployment environment is "local"; set deployment.environment to the real target (for example "staging" or "production") so environment policies and audit labels match the live integration',
      );
      continue;
    }

    if (mode) {
      continue;
    }

    for (const [configKey, value] of Object.entries(config)) {
      const url = getString(value);

      if (!url || !/^https?:\/\//i.test(url) || isLoopbackUrl(url)) {
        continue;
      }

      add(
        'warning',
        `connectors.${connectorKey}.${configKey}`,
        `Connector targets non-local URL "${url}" while the deployment environment is "local"; point it at a local endpoint or set deployment.environment to the real target so environment policies fire`,
      );
    }
  }
}

function runtimeCustomerApiUrl(environment: DeploymentEnvironmentDefinition | undefined): string | undefined {
  if (!environment) {
    return undefined;
  }

  const endpoint = (environment.evidence?.endpoints ?? []).find((candidate) => candidate.name === 'customer-api');

  return endpoint?.url ?? getString(asRecord(asRecord(environment.config).customerApi).url);
}

function normalizeUrlForComparison(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}

function isLoopbackUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);

    return hostname === 'localhost'
      || hostname === '[::1]'
      || hostname === '0.0.0.0'
      || hostname === 'host.docker.internal'
      || hostname.endsWith('.localhost')
      || hostname.startsWith('127.');
  } catch {
    return false;
  }
}

function validateArtifactStore(
  deployment: DeploymentDefinition,
  add: (severity: DeploymentValidationSeverity, path: string, message: string) => void,
): void {
  const artifacts = deployment.artifacts;

  if (!artifacts) {
    return;
  }

  if (artifacts.kind === undefined || artifacts.kind === 'local') {
    if (artifacts.rootDir !== undefined && typeof artifacts.rootDir !== 'string') {
      add('error', 'artifacts.rootDir', 'Local artifact rootDir must be a string');
    }

    return;
  }

  if (artifacts.kind !== 's3') {
    add('error', 'artifacts.kind', `Unsupported artifact store "${(artifacts as { kind?: string }).kind ?? 'unknown'}"`);
    return;
  }

  if (!artifacts.bucket || typeof artifacts.bucket !== 'string') {
    add('error', 'artifacts.bucket', 'S3 artifact store must declare a bucket');
  }

  if (artifacts.prefix !== undefined && typeof artifacts.prefix !== 'string') {
    add('error', 'artifacts.prefix', 'S3 artifact prefix must be a string');
  }

  if (artifacts.region !== undefined && typeof artifacts.region !== 'string') {
    add('error', 'artifacts.region', 'S3 artifact region must be a string');
  }
}

function registerToolName(
  toolNames: Map<string, string>,
  tool: AnyToolDefinition,
  owner: string,
  add: (severity: DeploymentValidationSeverity, path: string, message: string) => void,
): void {
  if (!tool.name) {
    return;
  }

  const existing = toolNames.get(tool.name);

  if (existing) {
    add('error', `${owner}.tools.${tool.name}`, `Tool name duplicates ${existing}`);
  } else {
    toolNames.set(tool.name, owner);
  }
}

function validateHarness(
  harness: HarnessDefinition,
  path: string,
  toolNames: Map<string, string>,
  policyNames: Set<string>,
  evalNames: Set<string>,
  add: (severity: DeploymentValidationSeverity, path: string, message: string) => void,
): void {
  if (!harness.name) {
    add('error', `${path}.name`, 'Harness must declare a name');
  }

  if (harness.maxSteps !== undefined && (!Number.isInteger(harness.maxSteps) || harness.maxSteps <= 0)) {
    add('error', `${path}.maxSteps`, 'Harness maxSteps must be a positive integer');
  }

  validateRefs(harness.toolRefs ?? [], toolNames, `${path}.toolRefs`, 'tool', add);
  validateRefs(harness.policyRefs ?? [], policyNames, `${path}.policyRefs`, 'policy', add);
  validateRefs(harness.evalRefs ?? [], evalNames, `${path}.evalRefs`, 'eval', add);
  validateRefs(harness.review?.evalRefs ?? [], evalNames, `${path}.review.evalRefs`, 'eval', add);
  validateTriggerRefs(harness.steer?.triggerRefs ?? [], policyNames, evalNames, `${path}.steer.triggerRefs`, add);

  if (!Array.isArray(harness.phases) || harness.phases.length === 0) {
    add('warning', `${path}.phases`, 'Harness should declare at least one phase');
    return;
  }

  for (const [index, phase] of harness.phases.entries()) {
    const phasePath = `${path}.phases.${phase.name || index}`;

    if (!phase.name) {
      add('error', phasePath, 'Harness phase must declare a name');
    }

    if (phase.maxSteps !== undefined && (!Number.isInteger(phase.maxSteps) || phase.maxSteps <= 0)) {
      add('error', `${phasePath}.maxSteps`, 'Harness phase maxSteps must be a positive integer');
    }

    validateRefs(phase.toolRefs ?? [], toolNames, `${phasePath}.toolRefs`, 'tool', add);
    validateRefs(phase.optionalToolRefs ?? [], toolNames, `${phasePath}.optionalToolRefs`, 'tool', add);
    validateRefs(phase.policyRefs ?? [], policyNames, `${phasePath}.policyRefs`, 'policy', add);
    validateRefs(phase.evalRefs ?? [], evalNames, `${phasePath}.evalRefs`, 'eval', add);
  }
}

function validateRefs(
  refs: string[],
  knownRefs: Map<string, string> | Set<string>,
  path: string,
  kind: 'tool' | 'policy' | 'eval',
  add: (severity: DeploymentValidationSeverity, path: string, message: string) => void,
): void {
  for (const ref of refs) {
    const known = knownRefs instanceof Map ? knownRefs.has(ref) : knownRefs.has(ref);

    if (!known) {
      add('warning', `${path}.${ref}`, `Harness references unknown ${kind} "${ref}"`);
    }
  }
}

function validateTriggerRefs(
  refs: string[],
  policyNames: Set<string>,
  evalNames: Set<string>,
  path: string,
  add: (severity: DeploymentValidationSeverity, path: string, message: string) => void,
): void {
  for (const ref of refs) {
    if (!policyNames.has(ref) && !evalNames.has(ref)) {
      add('warning', `${path}.${ref}`, `Harness references unknown trigger "${ref}"; trigger refs should match a policy or eval name`);
    }
  }
}

function collectPolicyNames(deployment: DeploymentDefinition): Set<string> {
  const names = new Set<string>();

  addGovernancePolicyNames(deployment.governance, names);
  for (const policy of deployment.policies ?? []) {
    if (policy.name) {
      names.add(policy.name);
    }
  }

  for (const agent of Object.values(deployment.agents ?? {})) {
    addGovernancePolicyNames(agent.governance, names);
    for (const policy of agent.policies ?? []) {
      if (policy.name) {
        names.add(policy.name);
      }
    }
  }

  return names;
}

function addGovernancePolicyNames(
  governance: DeploymentDefinition['governance'] | undefined,
  names: Set<string>,
): void {
  if (!governance) {
    return;
  }

  if (governance.dataProtection?.denyPII) {
    names.add('deny-pii-leak');
  }

  if (governance.dataProtection?.redactSecrets) {
    names.add('redact-secrets');
  }

  if (governance.environments?.allowed?.length || governance.environments?.denied?.length || governance.environments?.tools?.length) {
    names.add('restrict-environments');
  }

  if (governance.permissions) {
    names.add('limit-tool-scopes');
  }

  for (const budget of governance.budgets ?? []) {
    names.add(budget.name ?? 'limit-cost');
  }
}

function collectEvalNames(deployment: DeploymentDefinition): Set<string> {
  const names = new Set<string>();

  for (const evalDefinition of deployment.evals ?? []) {
    if (evalDefinition.name) {
      names.add(evalDefinition.name);
    }
  }

  for (const agent of Object.values(deployment.agents ?? {})) {
    for (const evalDefinition of agent.evals ?? []) {
      if (evalDefinition.name) {
        names.add(evalDefinition.name);
      }
    }
  }

  return names;
}
