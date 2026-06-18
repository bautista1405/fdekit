import { spawn } from 'child_process';
import * as path from 'path';
import type {
  DeploymentDefinition,
  DeploymentEnvironmentDefinition,
  EnvironmentCheckResult,
  EnvironmentCommandDefinition,
  EnvironmentHealthCheckDefinition,
} from '@fdekit/core';
import { loadDeployment, requireConfigFile } from '@fdekit/runtime';
import type { CommandContext } from '../context.js';
import { CliUserError } from '../errors.js';

type EnvAction = 'start' | 'stop' | 'seed' | 'doctor' | 'describe';

export async function cmdEnv(ctx: CommandContext): Promise<void> {
  const action = parseAction(ctx.args[0]);

  if (!action) {
    printEnvHelp();
    process.exitCode = 1;
    return;
  }

  const configPath = await requireConfigFile(ctx.cwd);
  const projectDir = path.dirname(configPath);
  const deployment = await loadDeployment(configPath);
  const environment = getRuntimeEnvironment(deployment);

  if (!environment) {
    console.log('No runtime environment configured');
    console.log('Add `runtimeEnvironment: defineEnvironment(...)` to fde.config.ts using `defineEnvironment` from `@fdekit/core`');
    console.log('Environment adapters are also available from `@fdekit/environment-docker` and `@fdekit/environment-floci`');
    process.exitCode = 1;
    return;
  }

  switch (action) {
    case 'start':
      await runEnvironmentCommands(environment.commands?.start ?? [], projectDir, 'start');
      return;
    case 'stop':
      await runEnvironmentCommands(environment.commands?.stop ?? [], projectDir, 'stop');
      return;
    case 'seed':
      await runEnvironmentCommands(environment.commands?.seed ?? [], projectDir, 'seed');
      return;
    case 'doctor':
      await runEnvironmentDoctor(environment, projectDir);
      return;
    case 'describe':
      printEnvironment(environment);
      return;
  }
}

function parseAction(value: string | undefined): EnvAction | null {
  if (value === 'start' || value === 'stop' || value === 'seed' || value === 'doctor' || value === 'describe') {
    return value;
  }

  return null;
}

function getRuntimeEnvironment(deployment: DeploymentDefinition): DeploymentEnvironmentDefinition | undefined {
  return deployment.runtimeEnvironment ?? deployment.localEnvironment;
}

async function runEnvironmentCommands(
  commands: EnvironmentCommandDefinition[],
  projectDir: string,
  phase: 'start' | 'stop' | 'seed',
): Promise<void> {
  console.log(`FDEKit env ${phase}`);

  if (commands.length === 0) {
    console.log(`No ${phase} commands configured`);
    return;
  }

  for (const command of commands) {
    console.log(`\n${command.name}`);
    if (command.description) {
      console.log(command.description);
    }
    console.log(`$ ${command.command}`);

    const code = await runShellCommand(command, projectDir);
    if (code !== 0) {
      const message = `Command failed with exit code ${code}: ${command.name}`;

      if (command.optional) {
        console.log(`Optional command failed: ${message}`);
      } else {
        throw new CliUserError(message, {
          next: ['Fix the configured environment command, or mark it optional if this failure should not block the workflow.'],
        });
      }
    }
  }
}

function runShellCommand(command: EnvironmentCommandDefinition, projectDir: string): Promise<number> {
  const cwd = command.cwd ? path.resolve(projectDir, command.cwd) : projectDir;

  return new Promise((resolve, reject) => {
    const child = spawn(command.command, {
      cwd,
      env: {
        ...process.env,
        ...(command.env ?? {}),
      },
      shell: true,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 0));
  });
}

async function runEnvironmentDoctor(environment: DeploymentEnvironmentDefinition, projectDir: string): Promise<void> {
  console.log('FDEKit env doctor');
  console.log(`Environment: ${environment.name}`);
  console.log(`Kind: ${environment.kind}`);
  console.log('');

  const checks = environment.healthChecks ?? [];
  if (checks.length === 0) {
    console.log('No environment health checks configured');
    return;
  }

  const results: EnvironmentCheckResult[] = [];
  for (const check of checks) {
    results.push(await runHealthCheck(check, projectDir));
  }

  for (const result of results) {
    const state = result.ok ? 'ok' : result.optional ? 'warn' : 'failed';
    const latency = result.latencyMs === undefined ? '' : ` ${Math.round(result.latencyMs)}ms`;
    const target = result.url ?? result.command ?? '';
    const message = result.message ? ` - ${result.message}` : '';
    console.log(`${state.toUpperCase()} ${result.name}${latency}${target ? ` ${target}` : ''}${message}`);
  }

  if (results.some((result) => !result.ok && !result.optional)) {
    process.exitCode = 1;
  }
}

async function runHealthCheck(
  check: EnvironmentHealthCheckDefinition,
  projectDir: string,
): Promise<EnvironmentCheckResult> {
  if (check.url) {
    return runUrlHealthCheck(check);
  }

  if (check.command) {
    const startedAt = Date.now();
    const code = await runShellCommand({
      name: check.name,
      command: check.command,
      cwd: check.cwd,
      env: check.env,
      optional: check.optional,
    }, projectDir);

    return {
      name: check.name,
      ok: code === 0,
      latencyMs: Date.now() - startedAt,
      command: check.command,
      optional: check.optional,
      message: code === 0 ? undefined : `exit code ${code}`,
    };
  }

  return {
    name: check.name,
    ok: false,
    optional: check.optional,
    message: 'Health check has no url or command',
  };
}

async function runUrlHealthCheck(check: EnvironmentHealthCheckDefinition): Promise<EnvironmentCheckResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), check.timeoutMs ?? 2000);

  try {
    const response = await fetch(check.url as string, {
      signal: controller.signal,
    });
    const expectedStatus = check.expectedStatus ?? 200;

    return {
      name: check.name,
      ok: response.status === expectedStatus,
      latencyMs: Date.now() - startedAt,
      url: check.url,
      optional: check.optional,
      message: response.status === expectedStatus ? undefined : `expected ${expectedStatus}, got ${response.status}`,
    };
  } catch (err) {
    return {
      name: check.name,
      ok: false,
      latencyMs: Date.now() - startedAt,
      url: check.url,
      optional: check.optional,
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function printEnvironment(environment: DeploymentEnvironmentDefinition): void {
  console.log('FDEKit env describe');
  console.log(`Environment: ${environment.name}`);
  console.log(`Kind: ${environment.kind}`);

  if (environment.description) {
    console.log(`Description: ${environment.description}`);
  }

  const endpoints = environment.evidence?.endpoints ?? [];
  if (endpoints.length > 0) {
    console.log('\nEndpoints');
    for (const endpoint of endpoints) {
      console.log(`  ${endpoint.name}: ${endpoint.url}`);
    }
  }

  const services = environment.evidence?.services ?? [];
  if (services.length > 0) {
    console.log('\nServices');
    for (const service of services) {
      const replicas = service.replicas === undefined ? '' : ` replicas=${service.replicas}`;
      const endpoint = service.endpoint ? ` endpoint=${service.endpoint}` : '';
      console.log(`  ${service.name}${service.kind ? ` (${service.kind})` : ''}${replicas}${endpoint}`);
    }
  }

  printCommandList('Start', environment.commands?.start ?? []);
  printCommandList('Seed', environment.commands?.seed ?? []);
  printCommandList('Stop', environment.commands?.stop ?? []);
}

function printCommandList(title: string, commands: EnvironmentCommandDefinition[]): void {
  if (commands.length === 0) {
    return;
  }

  console.log(`\n${title} commands`);
  for (const command of commands) {
    console.log(`  ${command.name}: ${command.command}`);
  }
}

function printEnvHelp(): void {
  console.log(`Usage: fdekit env <start|seed|doctor|stop|describe>

Commands:
  env start       Run configured environment start commands
  env seed        Run configured environment seed commands
  env doctor      Run configured environment health checks
  env stop        Run configured environment stop commands
  env describe    Print environment endpoints, services, and commands
`);
}
