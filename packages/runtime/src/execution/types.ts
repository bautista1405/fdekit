import type { ExecutionIdentity } from '@fdekit/core';
import type { ToolCallContext, ToolDefinition } from '@fdekit/core';

export const EXECUTION_BACKEND_PROTOCOL_VERSION = 1 as const;

export interface ExecutionBackendCapabilities {
  disposableWorkspace: boolean;
  commandAllowlist: boolean;
  environmentAllowlist: boolean;
  wallClockLimit: boolean;
  outputLimit: boolean;
  filesystemIsolation: boolean;
  processIsolation: boolean;
  networkIsolation: boolean;
}

export interface ExecutionIsolationRequirements {
  filesystemIsolation?: boolean;
  processIsolation?: boolean;
  networkIsolation?: boolean;
}

export interface WorkspaceSeedFile {
  path: string;
  content: string | Uint8Array;
}

export interface WorkspaceLeaseRequest {
  leaseId: string;
  ttlMs: number;
  identity?: Partial<ExecutionIdentity>;
  files?: WorkspaceSeedFile[];
  requirements?: ExecutionIsolationRequirements;
  metadata?: Record<string, unknown>;
}

export interface CredentialLeaseRequest {
  credentialRef: string;
  purpose: string;
  ttlMs?: number;
  identity?: Partial<ExecutionIdentity>;
}

/**
 * Host-only, short-lived credential material. Implementations must not expose
 * secret values as enumerable properties or serialize them into evidence.
 */
export interface CredentialLease {
  readonly leaseId: string;
  readonly credentialRef: string;
  readonly purpose: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  materializeEnvironment(): Promise<Record<string, string>>;
  release(): Promise<void>;
}

export interface CredentialBroker {
  acquire(request: CredentialLeaseRequest): Promise<CredentialLease>;
}

export interface ExecutionCommand {
  executable: string;
  args?: string[];
  cwd?: string;
  stdin?: string | Uint8Array;
  timeoutMs?: number;
  credentials?: CredentialLease[];
  signal?: AbortSignal;
}

export type ExecutionCommandStatus =
  | 'completed'
  | 'failed'
  | 'timed_out'
  | 'output_limited'
  | 'cancelled';

export interface ExecutionCommandResult {
  schemaVersion: typeof EXECUTION_BACKEND_PROTOCOL_VERSION;
  status: ExecutionCommandStatus;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface WorkspaceLease {
  readonly leaseId: string;
  readonly workspaceDir: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
  readonly capabilities: ExecutionBackendCapabilities;
  execute(command: ExecutionCommand): Promise<ExecutionCommandResult>;
  release(): Promise<void>;
}

export interface ExecutionBackend {
  readonly name: string;
  readonly capabilities: ExecutionBackendCapabilities;
  acquire(request: WorkspaceLeaseRequest): Promise<WorkspaceLease>;
}

export interface LocalExecutionBackendOptions {
  rootDir: string;
  allowedExecutables: string[];
  /** Host variables copied into a child. Defaults to none. */
  inheritedEnvironment?: string[];
  maxCommandTimeoutMs?: number;
  maxOutputBytes?: number;
  now?: () => Date;
  /** Test/custom process hook. Production callers should omit it. */
  spawn?: typeof import('node:child_process').spawn;
}

export interface EnvironmentCredentialBrokerOptions {
  /** credentialRef -> child variable -> source host variable. */
  bindings: Record<string, Record<string, string>>;
  env?: NodeJS.ProcessEnv;
  defaultTtlMs?: number;
  maxTtlMs?: number;
  now?: () => Date;
}

export interface ExecutionToolOptions<Args = unknown> {
  name: string;
  description?: string;
  argsSchema?: unknown;
  scopes?: string[];
  category?: string;
  tags?: string[];
  backend: ExecutionBackend;
  command: (args: Args, context: ToolCallContext) => ExecutionCommand;
  files?: (args: Args, context: ToolCallContext) => WorkspaceSeedFile[];
  requirements?: ExecutionIsolationRequirements;
  leaseTtlMs?: number;
  /** Non-completed command outcomes throw by default so the governed tool call is marked failed. */
  allowFailure?: boolean;
}

export type ExecutionTool<Args = unknown> = ToolDefinition<Args, ExecutionCommandResult>;

export interface DockerExecutionBackendOptions {
  rootDir: string;
  image: string;
  dockerExecutable: string;
  /** Exact executable paths/names accepted inside the container. */
  allowedExecutables: string[];
  maxCommandTimeoutMs?: number;
  maxOutputBytes?: number;
  memory?: string;
  cpus?: number;
  pidsLimit?: number;
  tmpfsSize?: string;
  now?: () => Date;
  /** Test/custom process hook. Production callers should omit it. */
  spawn?: typeof import('node:child_process').spawn;
}
