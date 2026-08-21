import { randomUUID } from 'node:crypto';
import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  DockerExecutionBackendOptions,
  ExecutionBackend,
  ExecutionBackendCapabilities,
  ExecutionCommand,
  ExecutionCommandResult,
  ExecutionCommandStatus,
  WorkspaceLease,
  WorkspaceLeaseRequest,
} from './types.js';
import { EXECUTION_BACKEND_PROTOCOL_VERSION } from './types.js';

const DOCKER_CAPABILITIES: ExecutionBackendCapabilities = Object.freeze({
  disposableWorkspace: true,
  commandAllowlist: true,
  environmentAllowlist: true,
  wallClockLimit: true,
  outputLimit: true,
  filesystemIsolation: true,
  processIsolation: true,
  networkIsolation: true,
});

interface ActiveContainer {
  child: ChildProcess;
  cancel: () => void;
}

export function createDockerExecutionBackend(options: DockerExecutionBackendOptions): ExecutionBackend {
  if (!options.image.trim()) throw new Error('Docker execution image is required');
  if (!path.isAbsolute(options.dockerExecutable)) {
    throw new Error('dockerExecutable must be an absolute host path');
  }
  if (options.allowedExecutables.length === 0) {
    throw new Error('Docker execution requires at least one allowed executable');
  }
  const allowedExecutables = new Set(options.allowedExecutables);
  const maxCommandTimeoutMs = positiveInteger(options.maxCommandTimeoutMs ?? 30_000, 'maxCommandTimeoutMs');
  const maxOutputBytes = positiveInteger(options.maxOutputBytes ?? 1_048_576, 'maxOutputBytes');
  const pidsLimit = positiveInteger(options.pidsLimit ?? 128, 'pidsLimit');
  const cpus = positiveNumber(options.cpus ?? 1, 'cpus');
  const memory = options.memory ?? '512m';
  const tmpfsSize = options.tmpfsSize ?? '64m';
  const now = options.now ?? (() => new Date());
  const spawn = options.spawn ?? nodeSpawn;

  return {
    name: 'docker',
    capabilities: DOCKER_CAPABILITIES,
    async acquire(request) {
      validateLeaseRequest(request);
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
      return new DockerWorkspaceLease({
        leaseId: request.leaseId,
        workspaceDir,
        acquiredAt: acquired.toISOString(),
        expiresAt: new Date(acquired.getTime() + request.ttlMs).toISOString(),
        image: options.image,
        dockerExecutable: options.dockerExecutable,
        allowedExecutables,
        maxCommandTimeoutMs,
        maxOutputBytes,
        pidsLimit,
        cpus,
        memory,
        tmpfsSize,
        now,
        spawn,
      });
    },
  };
}

class DockerWorkspaceLease implements WorkspaceLease {
  readonly capabilities = DOCKER_CAPABILITIES;
  readonly leaseId: string;
  readonly workspaceDir: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
  readonly #image: string;
  readonly #dockerExecutable: string;
  readonly #allowedExecutables: Set<string>;
  readonly #maxCommandTimeoutMs: number;
  readonly #maxOutputBytes: number;
  readonly #pidsLimit: number;
  readonly #cpus: number;
  readonly #memory: string;
  readonly #tmpfsSize: string;
  readonly #now: () => Date;
  readonly #spawn: typeof nodeSpawn;
  readonly #active = new Set<ActiveContainer>();
  #released = false;

  constructor(input: {
    leaseId: string;
    workspaceDir: string;
    acquiredAt: string;
    expiresAt: string;
    image: string;
    dockerExecutable: string;
    allowedExecutables: Set<string>;
    maxCommandTimeoutMs: number;
    maxOutputBytes: number;
    pidsLimit: number;
    cpus: number;
    memory: string;
    tmpfsSize: string;
    now: () => Date;
    spawn: typeof nodeSpawn;
  }) {
    this.leaseId = input.leaseId;
    this.workspaceDir = input.workspaceDir;
    this.acquiredAt = input.acquiredAt;
    this.expiresAt = input.expiresAt;
    this.#image = input.image;
    this.#dockerExecutable = input.dockerExecutable;
    this.#allowedExecutables = input.allowedExecutables;
    this.#maxCommandTimeoutMs = input.maxCommandTimeoutMs;
    this.#maxOutputBytes = input.maxOutputBytes;
    this.#pidsLimit = input.pidsLimit;
    this.#cpus = input.cpus;
    this.#memory = input.memory;
    this.#tmpfsSize = input.tmpfsSize;
    this.#now = input.now;
    this.#spawn = input.spawn;
  }

  async execute(command: ExecutionCommand): Promise<ExecutionCommandResult> {
    this.#assertActive();
    if (!this.#allowedExecutables.has(command.executable)) {
      throw new Error(`Executable "${command.executable}" is not allowed`);
    }
    const cwd = containerCwd(command.cwd ?? '.');
    const remainingMs = Date.parse(this.expiresAt) - this.#now().getTime();
    if (remainingMs <= 0) throw new Error(`Workspace lease "${this.leaseId}" is expired`);
    const requestedTimeout = command.timeoutMs === undefined
      ? this.#maxCommandTimeoutMs
      : positiveInteger(command.timeoutMs, 'command timeoutMs');
    const timeoutMs = Math.min(requestedTimeout, this.#maxCommandTimeoutMs, remainingMs);
    const secretDir = await this.#writeCredentialEnvironment(command);
    try {
      return await this.#run(command, cwd, timeoutMs, secretDir ? path.join(secretDir, 'environment') : undefined);
    } finally {
      if (secretDir) await rm(secretDir, { recursive: true, force: true });
    }
  }

  async release(): Promise<void> {
    if (this.#released) return;
    this.#released = true;
    for (const execution of this.#active) execution.cancel();
    await Promise.allSettled([...this.#active].map((execution) => waitForExit(execution.child)));
    this.#active.clear();
    await rm(this.workspaceDir, { recursive: true, force: true });
  }

  async #writeCredentialEnvironment(command: ExecutionCommand): Promise<string | undefined> {
    if (!command.credentials?.length) return undefined;
    const values: Record<string, string> = {};
    for (const credential of command.credentials) {
      for (const [name, value] of Object.entries(await credential.materializeEnvironment())) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || /[\r\n]/.test(value)) {
          throw new Error('Credential environment contains an unsafe name or multiline value');
        }
        if (values[name] !== undefined) throw new Error(`Credential environment variable "${name}" is already defined`);
        values[name] = value;
      }
    }
    const secretRoot = path.join(path.dirname(this.workspaceDir), '.credentials');
    await mkdir(secretRoot, { recursive: true, mode: 0o700 });
    const secretDir = await mkdtemp(path.join(secretRoot, `${this.leaseId}-`));
    await writeFile(
      path.join(secretDir, 'environment'),
      Object.entries(values).map(([name, value]) => `${name}=${value}\n`).join(''),
      { mode: 0o600, flag: 'wx' },
    );
    return secretDir;
  }

  #run(
    command: ExecutionCommand,
    cwd: string,
    timeoutMs: number,
    environmentFile: string | undefined,
  ): Promise<ExecutionCommandResult> {
    if (this.workspaceDir.includes(',')) {
      throw new Error('Docker workspace path cannot contain a comma');
    }
    const containerName = `fdekit-${this.leaseId.slice(0, 48)}-${randomUUID()}`
      .replace(/[^A-Za-z0-9_.-]/g, '-');
    const dockerArgs = [
      'run', '--rm', '--name', containerName,
      '--network', 'none',
      '--read-only',
      '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges',
      '--pids-limit', String(this.#pidsLimit),
      '--memory', this.#memory,
      '--cpus', String(this.#cpus),
      '--tmpfs', `/tmp:rw,noexec,nosuid,size=${this.#tmpfsSize}`,
      '--mount', `type=bind,src=${this.workspaceDir},dst=/workspace`,
      '--workdir', cwd,
      ...(environmentFile ? ['--env-file', environmentFile] : []),
      this.#image,
      command.executable,
      ...(command.args ?? []),
    ];
    const startedAt = this.#now();
    const child = this.#spawn(this.#dockerExecutable, dockerArgs, {
      env: {},
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
        void removeContainer(this.#spawn, this.#dockerExecutable, containerName);
      };
      const active: ActiveContainer = { child, cancel: () => kill('cancelled') };
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
        if (accepted.byteLength < bytes.byteLength) kill('output_limited');
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

function containerCwd(value: string): string {
  if (path.posix.isAbsolute(value)) throw new Error('Command cwd must stay inside the workspace');
  const normalized = path.posix.normalize(value);
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error('Command cwd must stay inside the workspace');
  }
  return normalized === '.' ? '/workspace' : `/workspace/${normalized}`;
}

function resolveInside(rootDir: string, candidate: string, label: string): string {
  if (path.isAbsolute(candidate)) throw new Error(`${label} must stay inside the workspace`);
  const resolved = path.resolve(rootDir, candidate);
  const relative = path.relative(rootDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} must stay inside the workspace`);
  return resolved;
}

async function removeContainer(
  spawn: typeof nodeSpawn,
  dockerExecutable: string,
  name: string,
): Promise<void> {
  const child = spawn(dockerExecutable, ['rm', '-f', name], { env: {}, shell: false, stdio: 'ignore' });
  await waitForExit(child);
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function positiveNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}

function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => child.once('close', () => resolve()));
}
