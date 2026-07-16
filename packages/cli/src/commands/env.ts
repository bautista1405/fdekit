import { spawn } from 'child_process';
import { promises as fs } from 'fs';
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

const ENV_USAGE = 'fdekit env <start|seed|doctor [--json]|stop|describe>';
const DEFAULT_READY_TIMEOUT_MS = 30_000;
const FOREGROUND_HEALTHY_WARN_MS = 5_000;

interface ShellCommandResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  output?: string;
}

export async function cmdEnv(ctx: CommandContext): Promise<void> {
  const action = parseAction(ctx.args[0]);

  if (!action) {
    printEnvHelp();
    process.exitCode = 1;
    return;
  }

  const options = parseEnvOptions(action, ctx.args.slice(1));
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
      await runEnvironmentStart(environment, projectDir);
      return;
    case 'stop':
      await runEnvironmentStop(environment, projectDir);
      return;
    case 'seed':
      await runEnvironmentCommands(environment.commands?.seed ?? [], projectDir, 'seed');
      return;
    case 'doctor':
      await runEnvironmentDoctor(environment, projectDir, options.json);
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

function parseEnvOptions(action: EnvAction, args: string[]): { json: boolean } {
  let json = false;

  for (const arg of args) {
    if (arg === '--json' && action === 'doctor') {
      json = true;
    } else {
      throw new CliUserError(`Unknown env ${action} option: ${arg}`, { usage: ENV_USAGE });
    }
  }

  return { json };
}

function getRuntimeEnvironment(deployment: DeploymentDefinition): DeploymentEnvironmentDefinition | undefined {
  return deployment.runtimeEnvironment ?? deployment.localEnvironment;
}

async function runEnvironmentStart(
  environment: DeploymentEnvironmentDefinition,
  projectDir: string,
): Promise<void> {
  const commands = environment.commands?.start ?? [];
  const healthChecks = environment.healthChecks ?? [];

  console.log('FDEKit env start');

  if (commands.length === 0) {
    console.log('No start commands configured');
    return;
  }

  if (healthChecks.length > 0 && await allRequiredChecksPass(healthChecks, projectDir)) {
    console.log('Environment is already running (all health checks passing); nothing to start');
    console.log('Run `fdekit env stop` first to restart it');
    return;
  }

  for (const command of commands) {
    printCommandHeader(command);

    if (command.background) {
      await startBackgroundCommand(command, projectDir);
      continue;
    }

    await runForegroundStartCommand(command, projectDir, healthChecks);
  }

  const backgroundCommands = commands.filter((command) => command.background);

  if (backgroundCommands.length > 0 && healthChecks.length > 0) {
    const readyTimeoutMs = Math.max(
      DEFAULT_READY_TIMEOUT_MS,
      ...backgroundCommands.map((command) => command.readyTimeoutMs ?? 0),
    );
    await waitForEnvironmentReady(healthChecks, projectDir, readyTimeoutMs);
  }
}

async function startBackgroundCommand(
  command: EnvironmentCommandDefinition,
  projectDir: string,
): Promise<void> {
  const logPath = path.join(envStateDir(projectDir), 'logs', `${sanitizeName(command.name)}.log`);
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const logFile = await fs.open(logPath, 'a');

  try {
    const child = spawn(command.command, {
      cwd: command.cwd ? path.resolve(projectDir, command.cwd) : projectDir,
      env: { ...process.env, ...(command.env ?? {}) },
      shell: true,
      detached: true,
      stdio: ['ignore', logFile.fd, logFile.fd],
    });

    if (child.pid === undefined) {
      throw new CliUserError(`Failed to start background command: ${command.name}`);
    }

    child.unref();
    await writePidFile(projectDir, command.name, child.pid);
    console.log(`Started in background (pid ${child.pid}); logs: ${logPath}`);
  } finally {
    await logFile.close();
  }
}

async function runForegroundStartCommand(
  command: EnvironmentCommandDefinition,
  projectDir: string,
  healthChecks: EnvironmentHealthCheckDefinition[],
): Promise<void> {
  // A plain server command never exits on its own; once the environment turns
  // healthy while the command is still running, say so instead of appearing hung.
  const warnTimer = healthChecks.length > 0
    ? setTimeout(() => {
      void allRequiredChecksPass(healthChecks, projectDir).then((healthy) => {
        if (healthy) {
          console.log(`\n[fdekit] "${command.name}" is still running and the environment's health checks pass.`);
          console.log('[fdekit] This start command looks like a long-lived server; mark it `background: true` so `fdekit env start` can return once healthy.');
          console.log('[fdekit] Waiting for the command to exit (Ctrl-C will stop the server with it)...');
        }
      });
    }, FOREGROUND_HEALTHY_WARN_MS)
    : undefined;

  try {
    const result = await runShellCommand(command, projectDir);
    assertCommandSucceeded(command, result);
  } finally {
    if (warnTimer) {
      clearTimeout(warnTimer);
    }
  }
}

async function runEnvironmentStop(
  environment: DeploymentEnvironmentDefinition,
  projectDir: string,
): Promise<void> {
  await runEnvironmentCommands(environment.commands?.stop ?? [], projectDir, 'stop');
  await stopBackgroundProcesses(projectDir);
}

async function stopBackgroundProcesses(projectDir: string): Promise<void> {
  const pidsDir = path.join(envStateDir(projectDir), 'pids');
  let entries: string[];

  try {
    entries = await fs.readdir(pidsDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.pid')) {
      continue;
    }

    const pidPath = path.join(pidsDir, entry);
    const pid = Number.parseInt(await fs.readFile(pidPath, 'utf8'), 10);

    if (Number.isInteger(pid) && pid > 0) {
      try {
        // Negative pid signals the detached process group started by env start.
        process.kill(-pid, 'SIGTERM');
        console.log(`Stopped background process group ${pid} (${entry.replace(/\.pid$/, '')})`);
      } catch {
        try {
          process.kill(pid, 'SIGTERM');
          console.log(`Stopped background process ${pid} (${entry.replace(/\.pid$/, '')})`);
        } catch {
          // Already gone; stopping an already-stopped environment is not an error.
        }
      }
    }

    await fs.rm(pidPath, { force: true });
  }
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
    printCommandHeader(command);
    const result = await runShellCommand(command, projectDir);
    assertCommandSucceeded(command, result);
  }
}

function printCommandHeader(command: EnvironmentCommandDefinition): void {
  console.log(`\n${command.name}`);
  if (command.description) {
    console.log(command.description);
  }
  console.log(`$ ${command.command}`);
}

function assertCommandSucceeded(command: EnvironmentCommandDefinition, result: ShellCommandResult): void {
  const failure = describeCommandFailure(result);

  if (!failure) {
    return;
  }

  const message = `Command ${failure}: ${command.name}`;

  if (command.optional) {
    console.log(`Optional command failed: ${message}`);
    return;
  }

  throw new CliUserError(message, {
    next: ['Fix the configured environment command, or mark it optional if this failure should not block the workflow.'],
  });
}

function describeCommandFailure(result: ShellCommandResult): string | null {
  if (result.signal) {
    return `was terminated by signal ${result.signal}`;
  }

  if (result.code !== 0) {
    return `failed with exit code ${result.code ?? 'unknown'}`;
  }

  return null;
}

function runShellCommand(
  command: EnvironmentCommandDefinition,
  projectDir: string,
  options: { captureOutput?: boolean } = {},
): Promise<ShellCommandResult> {
  const cwd = command.cwd ? path.resolve(projectDir, command.cwd) : projectDir;

  return new Promise((resolve, reject) => {
    const child = spawn(command.command, {
      cwd,
      env: {
        ...process.env,
        ...(command.env ?? {}),
      },
      shell: true,
      stdio: options.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let output = '';

    if (options.captureOutput) {
      child.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
    }

    child.on('error', reject);
    child.on('close', (code, signal) => resolve({
      code,
      signal,
      output: options.captureOutput ? output : undefined,
    }));
  });
}

async function runEnvironmentDoctor(
  environment: DeploymentEnvironmentDefinition,
  projectDir: string,
  json: boolean,
): Promise<void> {
  const checks = environment.healthChecks ?? [];
  const results: EnvironmentCheckResult[] = [];

  for (const check of checks) {
    results.push(await runHealthCheck(check, projectDir));
  }

  const ok = !results.some((result) => !result.ok && !result.optional);

  if (json) {
    console.log(JSON.stringify({
      environment: environment.name,
      kind: environment.kind,
      ok,
      checks: results,
    }, null, 2));

    if (!ok) {
      process.exitCode = 1;
    }

    return;
  }

  console.log('FDEKit env doctor');
  console.log(`Environment: ${environment.name}`);
  console.log(`Kind: ${environment.kind}`);
  console.log('');

  if (checks.length === 0) {
    console.log('No environment health checks configured');
    return;
  }

  for (const result of results) {
    const state = result.ok ? 'ok' : result.optional ? 'warn' : 'failed';
    const latency = result.latencyMs === undefined ? '' : ` ${Math.round(result.latencyMs)}ms`;
    const target = result.url ?? result.command ?? '';
    const message = result.message ? ` - ${result.message}` : '';
    console.log(`${state.toUpperCase()} ${result.name}${latency}${target ? ` ${target}` : ''}${message}`);
  }

  if (!ok) {
    process.exitCode = 1;
  }
}

async function allRequiredChecksPass(
  checks: EnvironmentHealthCheckDefinition[],
  projectDir: string,
): Promise<boolean> {
  const required = checks.filter((check) => !check.optional);

  if (required.length === 0) {
    return false;
  }

  for (const check of required) {
    const result = await runHealthCheck(check, projectDir, { quiet: true });

    if (!result.ok) {
      return false;
    }
  }

  return true;
}

async function waitForEnvironmentReady(
  checks: EnvironmentHealthCheckDefinition[],
  projectDir: string,
  timeoutMs: number,
): Promise<void> {
  const startedAt = Date.now();
  console.log(`\nWaiting for environment health checks (timeout ${Math.round(timeoutMs / 1000)}s)...`);

  while (Date.now() - startedAt < timeoutMs) {
    if (await allRequiredChecksPass(checks, projectDir)) {
      console.log(`Environment is healthy after ${Math.round((Date.now() - startedAt) / 1000)}s`);
      return;
    }

    await sleep(500);
  }

  throw new CliUserError(`Environment did not become healthy within ${Math.round(timeoutMs / 1000)}s`, {
    next: [
      'Check the background command logs under artifacts/env/logs/.',
      'Run `fdekit env doctor` to see which health check is failing.',
    ],
  });
}

async function runHealthCheck(
  check: EnvironmentHealthCheckDefinition,
  projectDir: string,
  options: { quiet?: boolean } = {},
): Promise<EnvironmentCheckResult> {
  if (check.url) {
    return runUrlHealthCheck(check);
  }

  if (check.command) {
    const startedAt = Date.now();
    // Health-check commands run captured: their output belongs to diagnostics,
    // not the doctor report, so it is shown only when the check fails.
    const result = await runShellCommand({
      name: check.name,
      command: check.command,
      cwd: check.cwd,
      env: check.env,
      optional: check.optional,
    }, projectDir, { captureOutput: true });
    const failure = describeCommandFailure(result);

    if (failure && !options.quiet && result.output?.trim()) {
      console.log(`--- output of failed health check "${check.name}"`);
      console.log(result.output.trim());
      console.log('---');
    }

    return {
      name: check.name,
      ok: !failure,
      latencyMs: Date.now() - startedAt,
      command: check.command,
      optional: check.optional,
      message: failure ?? undefined,
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

function envStateDir(projectDir: string): string {
  return path.join(projectDir, 'artifacts', 'env');
}

async function writePidFile(projectDir: string, commandName: string, pid: number): Promise<void> {
  const pidPath = path.join(envStateDir(projectDir), 'pids', `${sanitizeName(commandName)}.pid`);
  await fs.mkdir(path.dirname(pidPath), { recursive: true });
  await fs.writeFile(pidPath, `${pid}\n`, 'utf8');
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const healthChecks = environment.healthChecks ?? [];
  if (healthChecks.length > 0) {
    console.log('\nHealth checks');
    for (const check of healthChecks) {
      const target = check.url ?? check.command ?? '(no url or command)';
      const detail = [
        check.url && check.expectedStatus ? `expect ${check.expectedStatus}` : '',
        check.timeoutMs ? `timeout ${check.timeoutMs}ms` : '',
        check.optional ? 'optional' : '',
      ].filter(Boolean).join(', ');
      console.log(`  ${check.name}: ${target}${detail ? ` (${detail})` : ''}`);
    }
  }
}

function printCommandList(title: string, commands: EnvironmentCommandDefinition[]): void {
  if (commands.length === 0) {
    return;
  }

  console.log(`\n${title} commands`);
  for (const command of commands) {
    const flags = command.background ? ' [background]' : '';
    console.log(`  ${command.name}: ${command.command}${flags}`);
  }
}

function printEnvHelp(): void {
  console.log(`Usage: ${ENV_USAGE}

Commands:
  env start       Run configured environment start commands (background: true commands return once health checks pass)
  env seed        Run configured environment seed commands
  env doctor      Run configured environment health checks (--json for machine-readable output)
  env stop        Run configured environment stop commands, then stop recorded background processes
  env describe    Print environment endpoints, services, commands, and health checks
`);
}
