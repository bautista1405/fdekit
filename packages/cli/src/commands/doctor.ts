import * as path from 'path';
import { asRecord, getNumber, getString, type DeploymentDefinition } from '@fdekit/core';
import { loadDeployment, requireConfigFile } from '@fdekit/runtime';
import type { CommandContext } from '../context.js';

const defaultOllamaModel = 'llama3.1:8b';
const defaultOllamaBaseUrl = 'http://127.0.0.1:11434';

interface EnvCheck {
  scope: 'provider' | 'connector';
  owner: string;
  mode?: string;
  name: string;
  required: boolean;
  description?: string;
  configured: boolean;
}

interface EnvRequirementInput {
  scope: EnvCheck['scope'];
  owner: string;
  mode?: string;
  name: string;
  required?: boolean;
  description?: string;
}

interface LiveCheck {
  owner: string;
  toolName: string;
  ok: boolean;
  latencyMs?: number;
  message?: string;
}

interface ProviderReadinessCheck {
  owner: string;
  ok: boolean;
  latencyMs?: number;
  message: string;
}

export async function cmdDoctor(ctx: CommandContext): Promise<void> {
  const live = ctx.args.includes('--live');
  const configPath = await requireConfigFile(ctx.cwd);
  const deployment = await loadDeployment(configPath);
  const checks = collectEnvironmentChecks(deployment, process.env);
  const missingRequired = checks.filter((check) => check.required && !check.configured);
  const providerReadiness = await runProviderReadinessChecks(deployment);

  console.log('FDEKit doctor');
  console.log(`Deployment: ${deployment.name}`);
  console.log(`Environment: ${deployment.environment ?? 'local'}`);
  console.log(`Config: ${path.relative(ctx.cwd, configPath) || path.basename(configPath)}`);
  console.log('');
  printSection('Providers', checks.filter((check) => check.scope === 'provider'), Object.keys(deployment.providers ?? {}));
  console.log('');
  printSection('Connectors', checks.filter((check) => check.scope === 'connector'), Object.keys(deployment.connectors ?? {}));
  console.log('');

  if (providerReadiness.length > 0) {
    printProviderReadiness(providerReadiness);
    console.log('');
  }

  if (missingRequired.length > 0) {
    console.log(`Summary: ${missingRequired.length} missing required env var(s)`);
    process.exitCode = 1;
    return;
  }

  if (providerReadiness.some((check) => !check.ok)) {
    console.log('Summary: provider readiness warnings found');
    process.exitCode = 1;
    return;
  }

  if (live) {
    const liveChecks = await runLiveChecks(deployment);
    printLiveChecks(liveChecks);
    console.log('');

    if (liveChecks.some((check) => !check.ok)) {
      console.log('Summary: required env vars are set, but one or more live checks failed');
      process.exitCode = 1;
      return;
    }
  }

  console.log('Summary: all required env vars are set');
}

async function runProviderReadinessChecks(deployment: DeploymentDefinition): Promise<ProviderReadinessCheck[]> {
  const checks: ProviderReadinessCheck[] = [];
  const selections = collectOllamaProviderSelections(deployment);

  for (const selection of selections) {
    checks.push(await checkOllamaModel(selection));
  }

  return checks;
}

function collectOllamaProviderSelections(deployment: DeploymentDefinition): Array<{
  owner: string;
  model: string;
  apiBaseUrl: string;
}> {
  const selections: Array<{ owner: string; model: string; apiBaseUrl: string }> = [];
  const seen = new Set<string>();

  for (const agent of Object.values(deployment.agents ?? {})) {
    const providerKey = agent.provider ?? 'mock';
    const provider = deployment.providers?.[providerKey];

    if (!provider || !isOllamaProvider(providerKey, provider.name)) {
      continue;
    }

    const model = agent.model ?? provider.model ?? defaultOllamaModel;
    const apiBaseUrl = normalizeBaseUrl(getString(provider.options?.apiBaseUrl) ?? defaultOllamaBaseUrl);
    const key = `${providerKey}:${model}:${apiBaseUrl}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    selections.push({
      owner: providerKey,
      model,
      apiBaseUrl,
    });
  }

  return selections;
}

function isOllamaProvider(providerKey: string, providerName: string): boolean {
  return providerKey === 'localOllama'
    || providerKey === 'ollama'
    || providerName === 'localOllama'
    || providerName === 'ollama';
}

async function checkOllamaModel(selection: {
  owner: string;
  model: string;
  apiBaseUrl: string;
}): Promise<ProviderReadinessCheck> {
  const fetchImpl = globalThis.fetch;

  if (!fetchImpl) {
    return {
      owner: selection.owner,
      ok: false,
      message: `could not query Ollama models at ${selection.apiBaseUrl} - no fetch implementation is available`,
    };
  }

  const startedAt = Date.now();

  try {
    const response = await fetchImpl(`${selection.apiBaseUrl}/api/tags`);

    if (!response.ok) {
      return {
        owner: selection.owner,
        ok: false,
        latencyMs: Date.now() - startedAt,
        message: `could not query Ollama models at ${selection.apiBaseUrl} - ${response.status} ${response.statusText}`,
      };
    }

    const modelNames = ollamaModelNames(await response.json().catch(() => ({})));

    if (!modelNames.has(selection.model)) {
      return {
        owner: selection.owner,
        ok: false,
        latencyMs: Date.now() - startedAt,
        message: ollamaMissingModelMessage(selection.model, selection.apiBaseUrl),
      };
    }

    return {
      owner: selection.owner,
      ok: true,
      latencyMs: Date.now() - startedAt,
      message: `model "${selection.model}" is available on ${selection.apiBaseUrl}`,
    };
  } catch (err) {
    return {
      owner: selection.owner,
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: `could not query Ollama models at ${selection.apiBaseUrl} - ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function ollamaModelNames(value: unknown): Set<string> {
  const models = asRecord(value).models;
  const names = new Set<string>();

  if (!Array.isArray(models)) {
    return names;
  }

  for (const model of models) {
    const record = asRecord(model);
    const name = getString(record.name);
    const modelName = getString(record.model);

    if (name) {
      names.add(name);
    }

    if (modelName) {
      names.add(modelName);
    }
  }

  return names;
}

function ollamaMissingModelMessage(model: string, apiBaseUrl: string): string {
  return `model "${model}" not found on ${apiBaseUrl} - pull it or set FDEKIT_MODEL`;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function collectEnvironmentChecks(
  deployment: DeploymentDefinition,
  env: Record<string, string | undefined>,
): EnvCheck[] {
  const checks: EnvCheck[] = [];
  const seen = new Set<string>();
  const addCheck = (requirement: EnvRequirementInput) => {
    const key = `${requirement.scope}:${requirement.owner}:${requirement.name}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    checks.push(createCheck(requirement, env));
  };

  for (const [providerKey, provider] of Object.entries(deployment.providers ?? {})) {
    if (provider.apiKeyEnv) {
      addCheck({
        scope: 'provider',
        owner: providerKey,
        name: provider.apiKeyEnv,
        required: true,
        description: `${provider.name} API key`,
      });
    }

    for (const requirement of provider.env ?? []) {
      addCheck({
        scope: 'provider',
        owner: providerKey,
        ...requirement,
      });
    }
  }

  for (const [connectorKey, connector] of Object.entries(deployment.connectors ?? {})) {
    const mode = connectorMode(connector.config);

    for (const requirement of connector.env ?? []) {
      addCheck({
        scope: 'connector',
        owner: connectorKey,
        mode,
        ...requirement,
      });
    }
  }

  return checks;
}

function createCheck(
  requirement: EnvRequirementInput,
  env: Record<string, string | undefined>,
): EnvCheck {
  return {
    scope: requirement.scope,
    owner: requirement.owner,
    mode: requirement.mode,
    name: requirement.name,
    required: requirement.required ?? true,
    description: requirement.description,
    configured: Boolean(env[requirement.name]),
  };
}

function printSection(title: string, checks: EnvCheck[], owners: string[]): void {
  console.log(title);

  if (owners.length === 0) {
    console.log('  none');
    return;
  }

  for (const owner of owners) {
    const ownerChecks = checks.filter((check) => check.owner === owner);
    const mode = ownerChecks.find((check) => check.mode)?.mode;

    console.log(`  ${owner}${mode ? ` (${mode})` : ''}`);

    if (ownerChecks.length === 0) {
      console.log('    no env vars required');
      continue;
    }

    for (const check of ownerChecks) {
      const state = check.configured ? 'set' : 'missing';
      const required = check.required ? 'required' : 'optional';
      const description = check.description ? ` - ${check.description}` : '';
      console.log(`    ${check.name.padEnd(24)} ${state.padEnd(8)} ${required}${description}`);
    }
  }
}

function printProviderReadiness(checks: ProviderReadinessCheck[]): void {
  console.log('Provider Readiness');

  for (const check of checks) {
    const state = check.ok ? 'ok' : 'warning';
    const latency = check.latencyMs === undefined ? '' : ` ${check.latencyMs}ms`;
    console.log(`  ${check.owner} ${state}${latency} - ${check.message}`);
  }
}

async function runLiveChecks(deployment: DeploymentDefinition): Promise<LiveCheck[]> {
  const checks: LiveCheck[] = [];

  for (const [owner, connector] of Object.entries(deployment.connectors ?? {})) {
    for (const tool of connector.tools ?? []) {
      if (!tool.name.endsWith('.healthCheck')) {
        continue;
      }

      try {
        const startedAt = Date.now();
        const result = await tool.handler({}, {
          deploymentName: deployment.name,
          environment: deployment.environment,
        });
        const record = asRecord(result);
        checks.push({
          owner,
          toolName: tool.name,
          ok: record.ok === undefined ? true : record.ok === true,
          latencyMs: getNumber(record.latencyMs) ?? Date.now() - startedAt,
        });
      } catch (err) {
        checks.push({
          owner,
          toolName: tool.name,
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return checks;
}

function printLiveChecks(checks: LiveCheck[]): void {
  console.log('Live Checks');

  if (checks.length === 0) {
    console.log('  no connector health checks available');
    return;
  }

  for (const check of checks) {
    const state = check.ok ? 'ok' : 'failed';
    const latency = check.latencyMs === undefined ? '' : ` ${check.latencyMs}ms`;
    const message = check.message ? ` - ${check.message}` : '';
    console.log(`  ${check.owner} ${check.toolName} ${state}${latency}${message}`);
  }
}

function connectorMode(config: unknown): string | undefined {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return undefined;
  }

  const mode = (config as Record<string, unknown>).mode;
  return typeof mode === 'string' ? mode : undefined;
}
