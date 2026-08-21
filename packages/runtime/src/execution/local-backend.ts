import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ExecutionBackend,
  ExecutionBackendCapabilities,
  ExecutionCommand,
  ExecutionCommandResult,
  ExecutionCommandStatus,
  LocalExecutionBackendOptions,
  WorkspaceLease,
  WorkspaceLeaseRequest,
} from './types.js';
import { EXECUTION_BACKEND_PROTOCOL_VERSION } from './types.js';

interface ActiveExecution {
  child: ChildProcess;
  cancel: () => void;
}

const LOCAL_CAPABILITIES: ExecutionBackendCapabilities = Object.freeze({
  disposableWorkspace: true,
  commandAllowlist: true,
  environmentAllowlist: true,
  wallClockLimit: true,
  outputLimit: true,
  filesystemIsolation: false,
  processIsolation: false,
  networkIsolation: false,
});

export function createLocalExecutionBackend(
  options: LocalExecutionBackendOptions,
): ExecutionBackend {
  const allowedExecutables = new Set(options.allowedExecutables.map((item) => path.resolve(item)));
  const inheritedEnvironment = validateEnvironmentNames(options.inheritedEnvironment ?? []);
  const maxCommandTimeoutMs = positiveInteger(
    options.maxCommandTimeoutMs ?? 30_000,
    'maxCommandTimeoutMs',
  );
  const maxOutputBytes = positiveInteger(options.maxOutputBytes ?? 1_048_576, 'maxOutputBytes');
  const now = options.now ?? (() => new Date());
  const spawn = options.spawn ?? nodeSpawn;

  return {
    name: 'local',
    capabilities: LOCAL_CAPABILITIES,
    async acquire(request: WorkspaceLeaseRequest): Promise<WorkspaceLease> {
      validateLeaseRequest(request);
      enforceRequirements(request);
      await mkdir(options.rootDir, { recursive: true });
      const canonicalRoot = await realpath(options.rootDir);
      const workspaceDir = await mkdtemp(path.join(canonicalRoot, `${request.leaseId}-`));
      try {
        for (const file of request.files ?? []) {
          const filePath = resolveInside(workspaceDir, file.path, 'Workspace seed path');
          await mkdir(path.dirname(filePath), { recursive: true });
          await writeFile(filePath, file.content, { flag: 'wx' });
        }
      } catch (error) {
        await rm(workspaceDir, { recursive: true, force: true });
        throw error;
      }

      const acquired = now();
      return new LocalWorkspaceLease({
        leaseId: request.leaseId,
        workspaceDir,
        acquiredAt: acquired.toISOString(),
        expiresAt: new Date(acquired.getTime() + request.ttlMs).toISOString(),
        allowedExecutables,
        inheritedEnvironment,
        maxCommandTimeoutMs,
        maxOutputBytes,
        now,
        spawn,
      });
    },
  };
}

class LocalWorkspaceLease implements WorkspaceLease {
  readonly leaseId: string;
  readonly workspaceDir: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
  readonly capabilities = LOCAL_CAPABILITIES;
  readonly #allowedExecutables: Set<string>;
  readonly #inheritedEnvironment: string[];
  readonly #maxCommandTimeoutMs: number;
  readonly #maxOutputBytes: number;
  readonly #now: () => Date;
  readonly #spawn: typeof nodeSpawn;
  readonly #active = new Set<ActiveExecution>();
  #released = false;

  constructor(input: {
    leaseId: string;
    workspaceDir: string;
    acquiredAt: string;
    expiresAt: string;
    allowedExecutables: Set<string>;
    inheritedEnvironment: string[];
    maxCommandTimeoutMs: number;
    maxOutputBytes: number;
    now: () => Date;
    spawn: typeof nodeSpawn;
  }) {
    this.leaseId = input.leaseId;
    this.workspaceDir = input.workspaceDir;
    this.acquiredAt = input.acquiredAt;
    this.expiresAt = input.expiresAt;
    this.#allowedExecutables = input.allowedExecutables;
    this.#inheritedEnvironment = input.inheritedEnvironment;
    this.#maxCommandTimeoutMs = input.maxCommandTimeoutMs;
    this.#maxOutputBytes = input.maxOutputBytes;
    this.#now = input.now;
    this.#spawn = input.spawn;
  }

  async execute(command: ExecutionCommand): Promise<ExecutionCommandResult> {
    this.#assertActive();
    const executable = path.resolve(command.executable);
    if (!this.#allowedExecutables.has(executable)) {
      throw new Error(`Executable "${command.executable}" is not allowed`);
    }

    const requestedCwd = resolveInside(
      this.workspaceDir,
      command.cwd ?? '.',
      'Command cwd',
    );
    const cwd = await realpath(requestedCwd).catch(() => requestedCwd);
    if (!isInside(this.workspaceDir, cwd)) {
      throw new Error('Command cwd must stay inside the workspace');
    }

    const environment = await this.#commandEnvironment(command);
    this.#assertActive();
    const nowMs = this.#now().getTime();
    const leaseRemainingMs = Date.parse(this.expiresAt) - nowMs;
    if (leaseRemainingMs <= 0) throw new Error(`Workspace lease "${this.leaseId}" is expired`);
    const requestedTimeout = command.timeoutMs === undefined
      ? this.#maxCommandTimeoutMs
      : positiveInteger(command.timeoutMs, 'command timeoutMs');
    const timeoutMs = Math.min(requestedTimeout, this.#maxCommandTimeoutMs, leaseRemainingMs);

    return this.#run(command, executable, cwd, environment, timeoutMs);
  }

  async release(): Promise<void> {
    if (this.#released) return;
    this.#released = true;
    for (const execution of this.#active) execution.cancel();
    await Promise.allSettled(
      [...this.#active].map((execution) => waitForExit(execution.child)),
    );
    this.#active.clear();
    await rm(this.workspaceDir, { recursive: true, force: true });
  }

  async #commandEnvironment(command: ExecutionCommand): Promise<NodeJS.ProcessEnv> {
    const environment: NodeJS.ProcessEnv = {};
    for (const name of this.#inheritedEnvironment) {
      if (process.env[name] !== undefined) environment[name] = process.env[name];
    }
    for (const credential of command.credentials ?? []) {
      const values = await credential.materializeEnvironment();
      for (const [name, value] of Object.entries(values)) {
        if (environment[name] !== undefined) {
          throw new Error(`Credential environment variable "${name}" is already defined`);
        }
        environment[name] = value;
      }
    }
    return environment;
  }

  #run(
    command: ExecutionCommand,
    executable: string,
    cwd: string,
    environment: NodeJS.ProcessEnv,
    timeoutMs: number,
  ): Promise<ExecutionCommandResult> {
    const startedAt = this.#now();
    const child = this.#spawn(executable, command.args ?? [], {
      cwd,
      env: environment,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let status: ExecutionCommandStatus | undefined;
    let completed = false;
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let capturedBytes = 0;

    return new Promise((resolve) => {
      const kill = (nextStatus: ExecutionCommandStatus) => {
        if (completed || status) return;
        status = nextStatus;
        child.kill('SIGKILL');
      };
      const active: ActiveExecution = { child, cancel: () => kill('cancelled') };
      this.#active.add(active);
      const timeout = setTimeout(() => kill('timed_out'), timeoutMs);
      const abort = () => kill('cancelled');
      command.signal?.addEventListener('abort', abort, { once: true });

      const capture = (stream: 'stdout' | 'stderr', chunk: Buffer | string) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const remaining = Math.max(0, this.#maxOutputBytes - capturedBytes);
        const accepted = bytes.subarray(0, remaining);
        if (stream === 'stdout') stdout = Buffer.concat([stdout, accepted]);
        else stderr = Buffer.concat([stderr, accepted]);
        capturedBytes += accepted.byteLength;
        if (accepted.byteLength < bytes.byteLength) {
          kill('output_limited');
        }
      };
      child.stdout?.on('data', (chunk) => capture('stdout', chunk));
      child.stderr?.on('data', (chunk) => capture('stderr', chunk));
      child.stdin?.on('error', () => undefined);
      child.on('error', (error) => {
        if (!status) status = 'failed';
        capture('stderr', error.message);
      });
      child.on('close', (exitCode, signal) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeout);
        command.signal?.removeEventListener('abort', abort);
        this.#active.delete(active);
        const completedAt = this.#now();
        resolve({
          schemaVersion: EXECUTION_BACKEND_PROTOCOL_VERSION,
          status: status ?? (exitCode === 0 ? 'completed' : 'failed'),
          exitCode: status ? null : exitCode,
          signal: signal as NodeJS.Signals | null,
          stdout: stdout.toString('utf8'),
          stderr: stderr.toString('utf8'),
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
        });
      });

      if (command.signal?.aborted) abort();
      if (command.stdin === undefined) child.stdin?.end();
      else child.stdin?.end(command.stdin);
    });
  }

  #assertActive(): void {
    if (this.#released) throw new Error(`Workspace lease "${this.leaseId}" is released`);
  }
}

function validateLeaseRequest(request: WorkspaceLeaseRequest): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(request.leaseId)) {
    throw new Error('Workspace leaseId must contain only letters, numbers, dots, underscores, and dashes');
  }
  positiveInteger(request.ttlMs, 'workspace ttlMs');
}

function enforceRequirements(request: WorkspaceLeaseRequest): void {
  for (const capability of [
    'filesystemIsolation',
    'processIsolation',
    'networkIsolation',
  ] as const) {
    if (request.requirements?.[capability] && !LOCAL_CAPABILITIES[capability]) {
      const label = capability.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
      throw new Error(`Local execution backend cannot provide ${label}`);
    }
  }
}

function resolveInside(rootDir: string, candidate: string, label: string): string {
  if (path.isAbsolute(candidate)) throw new Error(`${label} must stay inside the workspace`);
  const resolved = path.resolve(rootDir, candidate);
  if (!isInside(rootDir, resolved)) throw new Error(`${label} must stay inside the workspace`);
  return resolved;
}

function isInside(rootDir: string, candidate: string): boolean {
  const relative = path.relative(rootDir, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function validateEnvironmentNames(names: string[]): string[] {
  const expression = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const unique = new Set<string>();
  for (const name of names) {
    if (!expression.test(name)) throw new Error(`Invalid inherited environment variable "${name}"`);
    unique.add(name);
  }
  return [...unique];
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => child.once('close', () => resolve()));
}
