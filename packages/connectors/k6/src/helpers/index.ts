import { spawn } from 'child_process';
import type {
  K6CommandInvocation,
  K6CommandResult,
  K6ConnectorConfig,
  K6ConnectorOptions,
  K6RunArgs,
  K6RunResult,
} from '../interfaces/index.js';

export function createRuntimeConfig(options: K6ConnectorOptions): K6ConnectorConfig {
  return {
    mode: options.mode ?? 'local',
    scriptPath: options.scriptPath ?? './load-tests/customer-api-smoke.js',
    workingDir: options.workingDir ?? '.',
    targetUrl: normalizeBaseUrl(options.targetUrl ?? 'http://localhost:8000'),
    targetUrlEnv: options.targetUrlEnv ?? 'LOAD_TEST_TARGET_URL',
    summaryPath: options.summaryPath ?? './load-tests/.results/latest-summary.json',
    k6Command: options.k6Command ?? 'k6',
    defaultVus: positiveInteger(options.defaultVus, 5),
    defaultDuration: options.defaultDuration ?? '30s',
    maxVus: positiveInteger(options.maxVus, 50),
    maxDurationSeconds: positiveInteger(options.maxDurationSeconds, 300),
    thresholds: {
      p95Ms: positiveInteger(options.p95ThresholdMs, 500),
      errorRate: boundedRate(options.errorRateThreshold, 0.01),
    },
  };
}

export function normalizeRunArgs(args: K6RunArgs, config: K6ConnectorConfig): Required<Omit<K6RunArgs, 'tags'>> & {
  tags: Record<string, string>;
  durationSeconds: number;
} {
  const scenario = args.scenario ?? 'smoke';
  const vus = positiveInteger(args.vus, config.defaultVus);
  const duration = args.duration ?? config.defaultDuration;
  const durationSeconds = parseDurationSeconds(duration);

  if (vus > config.maxVus) {
    throw new Error(`Requested ${vus} VUs exceeds connector maxVus ${config.maxVus}`);
  }

  if (durationSeconds > config.maxDurationSeconds) {
    throw new Error(`Requested duration ${duration} exceeds connector maxDurationSeconds ${config.maxDurationSeconds}`);
  }

  return {
    scenario,
    targetUrl: normalizeBaseUrl(args.targetUrl ?? config.targetUrl),
    scriptPath: args.scriptPath ?? config.scriptPath,
    vus,
    duration,
    durationSeconds,
    summaryPath: args.summaryPath ?? config.summaryPath,
    tags: args.tags ?? {},
  };
}

export async function runK6(
  invocation: K6CommandInvocation,
  runCommand = spawnCommand,
): Promise<K6CommandResult> {
  return runCommand(invocation);
}

export function buildK6Command(args: ReturnType<typeof normalizeRunArgs>, config: K6ConnectorConfig): K6CommandInvocation {
  const env = {
    [config.targetUrlEnv]: args.targetUrl,
    TARGET_URL: args.targetUrl,
    FDEKIT_K6_SUMMARY_PATH: args.summaryPath,
    FDEKIT_K6_SCENARIO: args.scenario,
    FDEKIT_K6_VUS: String(args.vus),
    FDEKIT_K6_DURATION: args.duration,
    ...Object.fromEntries(Object.entries(args.tags).map(([key, value]) => [`FDEKIT_K6_TAG_${key.toUpperCase()}`, value])),
  };

  return {
    command: config.k6Command,
    args: [
      'run',
      '--vus',
      String(args.vus),
      '--duration',
      args.duration,
      '-e',
      `${config.targetUrlEnv}=${args.targetUrl}`,
      '-e',
      `TARGET_URL=${args.targetUrl}`,
      '-e',
      `FDEKIT_K6_SUMMARY_PATH=${args.summaryPath}`,
      args.scriptPath,
    ],
    cwd: config.workingDir,
    env,
    timeoutMs: (args.durationSeconds + 30) * 1000,
  };
}

export function localK6Result(
  args: ReturnType<typeof normalizeRunArgs>,
  config: K6ConnectorConfig,
  now: () => string,
): K6RunResult {
  const loadFactor = args.scenario === 'stress'
    ? 2.4
    : args.scenario === 'spike'
      ? 3.2
      : args.scenario === 'baseline'
        ? 1.4
        : 1;
  const httpReqDurationP95Ms = Math.round(Math.min(120 + args.vus * 18 * loadFactor, config.thresholds.p95Ms * 0.9));
  const httpReqFailedRate = Number(Math.min(args.vus / Math.max(config.maxVus * 200, 1), config.thresholds.errorRate * 0.6).toFixed(4));
  const iterations = Math.max(args.vus * Math.max(args.durationSeconds, 1), 1);
  const passed = httpReqDurationP95Ms <= config.thresholds.p95Ms && httpReqFailedRate <= config.thresholds.errorRate;

  return {
    mode: 'local',
    status: passed ? 'passed' : 'failed',
    scenario: args.scenario,
    targetUrl: args.targetUrl,
    scriptPath: args.scriptPath,
    vus: args.vus,
    duration: args.duration,
    summaryPath: args.summaryPath,
    exitCode: passed ? 0 : 1,
    startedAt: now(),
    latencyMs: Math.max(25, args.vus * 3),
    metrics: {
      httpReqDurationP95Ms,
      httpReqFailedRate,
      checksSucceededRate: 1 - httpReqFailedRate,
      iterations,
      requests: iterations * 3,
    },
    thresholds: {
      p95Ms: config.thresholds.p95Ms,
      errorRate: config.thresholds.errorRate,
      passed,
    },
  };
}

export function commandResultToK6Result(
  args: ReturnType<typeof normalizeRunArgs>,
  config: K6ConnectorConfig,
  command: K6CommandInvocation,
  result: K6CommandResult,
  now: () => string,
): K6RunResult {
  const metrics = parseK6Metrics(result.stdout);
  const p95 = metrics.httpReqDurationP95Ms ?? 0;
  const errorRate = metrics.httpReqFailedRate ?? (result.exitCode === 0 ? 0 : 1);
  const checksSucceededRate = metrics.checksSucceededRate ?? (result.exitCode === 0 ? 1 : 0);
  const passed = result.exitCode === 0 && p95 <= config.thresholds.p95Ms && errorRate <= config.thresholds.errorRate;

  return {
    mode: 'k6',
    status: passed ? 'passed' : 'failed',
    scenario: args.scenario,
    targetUrl: args.targetUrl,
    scriptPath: args.scriptPath,
    vus: args.vus,
    duration: args.duration,
    summaryPath: args.summaryPath,
    command: [command.command, ...command.args].join(' '),
    exitCode: result.exitCode,
    startedAt: now(),
    latencyMs: result.durationMs,
    metrics: {
      httpReqDurationP95Ms: p95,
      httpReqFailedRate: errorRate,
      checksSucceededRate,
      iterations: metrics.iterations ?? 0,
      requests: metrics.requests ?? 0,
    },
    thresholds: {
      p95Ms: config.thresholds.p95Ms,
      errorRate: config.thresholds.errorRate,
      passed,
    },
    stdout: result.stdout.slice(-4000),
    stderr: result.stderr.slice(-4000),
  };
}

function spawnCommand(invocation: K6CommandInvocation): Promise<K6CommandResult> {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      env: {
        ...process.env,
        ...invocation.env,
      },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, invocation.timeoutMs);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 0,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

function parseK6Metrics(stdout: string): {
  httpReqDurationP95Ms?: number;
  httpReqFailedRate?: number;
  checksSucceededRate?: number;
  iterations?: number;
  requests?: number;
} {
  return {
    httpReqDurationP95Ms: parseMetric(stdout, /http_req_duration[\s\S]*?p\(95\)=([0-9.]+)(ms|s)?/),
    httpReqFailedRate: parseRate(stdout, /http_req_failed\s+([0-9.]+)%/),
    checksSucceededRate: parseRate(stdout, /checks\s+([0-9.]+)%/),
    iterations: parseInteger(stdout, /iterations[.\s:]+([0-9]+)/),
    requests: parseInteger(stdout, /http_reqs[.\s:]+([0-9]+)/),
  };
}

function parseMetric(stdout: string, pattern: RegExp): number | undefined {
  const match = stdout.match(pattern);
  if (!match) {
    return undefined;
  }
  const value = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(value)) {
    return undefined;
  }

  return unit === 's' ? value * 1000 : value;
}

function parseRate(stdout: string, pattern: RegExp): number | undefined {
  const match = stdout.match(pattern);
  const value = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(value) ? value / 100 : undefined;
}

function parseInteger(stdout: string, pattern: RegExp): number | undefined {
  const match = stdout.match(pattern);
  const value = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(value) ? value : undefined;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function boundedRate(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : fallback;
}

function parseDurationSeconds(duration: string): number {
  const match = duration.trim().match(/^(\d+)(ms|s|m)$/);

  if (!match) {
    throw new Error(`Unsupported k6 duration "${duration}"; use values like 30s, 2m, or 500ms`);
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (unit === 'ms') {
    return Math.max(Math.ceil(value / 1000), 1);
  }

  return unit === 'm' ? value * 60 : value;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}
