import { access, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createEnvironmentCredentialBroker,
  createLocalExecutionBackend,
  defineExecutionTool,
} from '../execution/index.js';

describe('local execution backend', () => {
  it('wraps a backend command as a normal governed tool with automatic lease cleanup', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-execution-tool-'));
    const backend = createLocalExecutionBackend({
      rootDir,
      allowedExecutables: [process.execPath],
    });
    const tool = defineExecutionTool<{ value: string }>({
      name: 'isolated.echo',
      backend,
      files: (args) => [{ path: 'input.txt', content: args.value }],
      command: () => ({
        executable: process.execPath,
        args: ['-e', "process.stdout.write(require('node:fs').readFileSync('input.txt','utf8'))"],
      }),
    });

    await expect(tool.handler({ value: 'governed' }, {})).resolves.toMatchObject({
      status: 'completed',
      stdout: 'governed',
    });
    expect(tool.metadata).toMatchObject({ executionBackend: 'local' });
  });

  it('leases a disposable workspace, executes an allowlisted command, and cleans up', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-execution-'));
    const backend = createLocalExecutionBackend({
      rootDir,
      allowedExecutables: [process.execPath],
      maxCommandTimeoutMs: 1_000,
      maxOutputBytes: 1_024,
    });
    const lease = await backend.acquire({
      leaseId: 'lease-1',
      ttlMs: 5_000,
      files: [{ path: 'input.txt', content: 'workspace evidence' }],
    });

    expect(lease.capabilities).toMatchObject({
      disposableWorkspace: true,
      commandAllowlist: true,
      environmentAllowlist: true,
      filesystemIsolation: false,
      processIsolation: false,
      networkIsolation: false,
    });
    const result = await lease.execute({
      executable: process.execPath,
      args: [
        '-e',
        "const fs=require('node:fs'); process.stdout.write(fs.readFileSync('input.txt','utf8'))",
      ],
    });

    expect(result).toMatchObject({
      status: 'completed',
      exitCode: 0,
      stdout: 'workspace evidence',
      stderr: '',
    });

    const workspaceDir = lease.workspaceDir;
    await lease.release();
    await expect(access(workspaceDir)).rejects.toThrow();
    await expect(lease.execute({ executable: process.execPath })).rejects.toThrow(
      'Workspace lease "lease-1" is released',
    );
  });

  it('blocks executable and working-directory escapes before spawning', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-execution-'));
    const backend = createLocalExecutionBackend({
      rootDir,
      allowedExecutables: [process.execPath],
    });
    const lease = await backend.acquire({ leaseId: 'lease-boundary', ttlMs: 5_000 });

    await expect(lease.execute({ executable: '/bin/sh' })).rejects.toThrow(
      'Executable "/bin/sh" is not allowed',
    );
    await expect(lease.execute({
      executable: process.execPath,
      cwd: '../outside',
    })).rejects.toThrow('Command cwd must stay inside the workspace');

    await lease.release();

    await expect(backend.acquire({
      leaseId: 'lease-seed-boundary',
      ttlMs: 5_000,
      files: [{ path: '../outside.txt', content: 'must not escape' }],
    })).rejects.toThrow('Workspace seed path must stay inside the workspace');
  });

  it('enforces wall-clock and output limits with explicit outcomes', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-execution-'));
    const backend = createLocalExecutionBackend({
      rootDir,
      allowedExecutables: [process.execPath],
      maxCommandTimeoutMs: 1_000,
      maxOutputBytes: 128,
    });
    const lease = await backend.acquire({ leaseId: 'lease-limits', ttlMs: 5_000 });

    const timedOut = await lease.execute({
      executable: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 1000)'],
      timeoutMs: 50,
    });
    expect(timedOut).toMatchObject({ status: 'timed_out', exitCode: null });

    const outputLimited = await lease.execute({
      executable: process.execPath,
      args: ['-e', "process.stdout.write('x'.repeat(4096))"],
    });
    expect(outputLimited).toMatchObject({ status: 'output_limited', exitCode: null });
    expect(Buffer.byteLength(outputLimited.stdout) + Buffer.byteLength(outputLimited.stderr))
      .toBeLessThanOrEqual(128);

    await lease.release();
  });

  it('fails closed when callers require isolation the local backend cannot provide', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-execution-'));
    const backend = createLocalExecutionBackend({
      rootDir,
      allowedExecutables: [process.execPath],
    });

    await expect(backend.acquire({
      leaseId: 'lease-isolated',
      ttlMs: 5_000,
      requirements: { networkIsolation: true },
    })).rejects.toThrow('Local execution backend cannot provide network isolation');
  });
});

describe('environment credential broker', () => {
  it('leases allowlisted environment credentials without serializing secret material', async () => {
    let nowMs = Date.parse('2026-08-20T12:00:00.000Z');
    const broker = createEnvironmentCredentialBroker({
      bindings: {
        'provider:test': {
          PROVIDER_TOKEN: 'SOURCE_PROVIDER_TOKEN',
        },
      },
      env: { SOURCE_PROVIDER_TOKEN: 'top-secret-value' },
      now: () => new Date(nowMs),
      defaultTtlMs: 5_000,
    });
    const credential = await broker.acquire({
      credentialRef: 'provider:test',
      purpose: 'provider request',
    });

    expect(JSON.stringify(credential)).toContain('provider:test');
    expect(JSON.stringify(credential)).not.toContain('top-secret-value');
    expect(await credential.materializeEnvironment()).toEqual({
      PROVIDER_TOKEN: 'top-secret-value',
    });

    nowMs += 5_001;
    await expect(credential.materializeEnvironment()).rejects.toThrow(
      'Credential lease is expired',
    );
    await credential.release();
    await expect(credential.materializeEnvironment()).rejects.toThrow(
      'Credential lease is released',
    );
  });

  it('injects credential leases into a command without inheriting the host environment', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-execution-'));
    const broker = createEnvironmentCredentialBroker({
      bindings: {
        'provider:test': { PROVIDER_TOKEN: 'SOURCE_PROVIDER_TOKEN' },
      },
      env: { SOURCE_PROVIDER_TOKEN: 'top-secret-value' },
    });
    const credential = await broker.acquire({
      credentialRef: 'provider:test',
      purpose: 'provider request',
    });
    const backend = createLocalExecutionBackend({
      rootDir,
      allowedExecutables: [process.execPath],
      inheritedEnvironment: ['PATH'],
    });
    const lease = await backend.acquire({ leaseId: 'lease-credential', ttlMs: 5_000 });

    const result = await lease.execute({
      executable: process.execPath,
      args: [
        '-e',
        "process.stdout.write(process.env.PROVIDER_TOKEN === 'top-secret-value' && !process.env.HOME ? 'scoped' : 'leaked')",
      ],
      credentials: [credential],
    });
    expect(result).toMatchObject({ status: 'completed', stdout: 'scoped' });

    await lease.release();
    await credential.release();
  });
});
