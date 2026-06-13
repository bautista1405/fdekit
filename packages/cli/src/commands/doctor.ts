import * as path from 'path';
import { asRecord, getNumber, type DeploymentDefinition } from '@fdekit/core';
import { loadDeployment, requireConfigFile } from '@fdekit/runtime';
import type { CommandContext } from '../context.js';

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

export async function cmdDoctor(ctx: CommandContext): Promise<void> {
  const live = ctx.args.includes('--live');
  const configPath = await requireConfigFile(ctx.cwd);
  const deployment = await loadDeployment(configPath);
  const checks = collectEnvironmentChecks(deployment, process.env);
  const missingRequired = checks.filter((check) => check.required && !check.configured);

  console.log('FDEKit doctor');
  console.log(`Deployment: ${deployment.name}`);
  console.log(`Environment: ${deployment.environment ?? 'local'}`);
  console.log(`Config: ${path.relative(ctx.cwd, configPath) || path.basename(configPath)}`);
  console.log('');
  printSection('Providers', checks.filter((check) => check.scope === 'provider'), Object.keys(deployment.providers ?? {}));
  console.log('');
  printSection('Connectors', checks.filter((check) => check.scope === 'connector'), Object.keys(deployment.connectors ?? {}));
  console.log('');

  if (missingRequired.length > 0) {
    console.log(`Summary: ${missingRequired.length} missing required env var(s)`);
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
