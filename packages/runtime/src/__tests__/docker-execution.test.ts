import { EventEmitter } from 'node:events';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type { spawn as nodeSpawn } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { createDockerExecutionBackend } from '../execution/index.js';

describe('docker execution backend', () => {
  it('uses a hardened, network-disabled container command and advertises real isolation', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-docker-execution-'));
    const calls: Array<{ executable: string; args: string[] }> = [];
    const spawn = vi.fn((executable: string, args: string[]) => {
      calls.push({ executable, args });
      const child = new EventEmitter() as EventEmitter & {
        stdout: PassThrough;
        stderr: PassThrough;
        stdin: PassThrough;
        exitCode: number | null;
        signalCode: NodeJS.Signals | null;
        kill: () => boolean;
      };
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.exitCode = null;
      child.signalCode = null;
      child.kill = () => true;
      queueMicrotask(() => {
        child.stdout.end('isolated');
        child.exitCode = 0;
        child.emit('close', 0, null);
      });
      return child;
    }) as unknown as typeof nodeSpawn;
    const backend = createDockerExecutionBackend({
      rootDir,
      image: 'node@sha256:test',
      dockerExecutable: '/usr/bin/docker',
      allowedExecutables: ['node'],
      spawn,
    });
    const lease = await backend.acquire({
      leaseId: 'docker-1',
      ttlMs: 5_000,
      requirements: {
        filesystemIsolation: true,
        processIsolation: true,
        networkIsolation: true,
      },
    });
    const result = await lease.execute({ executable: 'node', args: ['script.mjs'] });

    expect(lease.capabilities).toMatchObject({
      filesystemIsolation: true,
      processIsolation: true,
      networkIsolation: true,
    });
    expect(result).toMatchObject({ status: 'completed', stdout: 'isolated' });
    expect(calls[0]).toMatchObject({ executable: '/usr/bin/docker' });
    expect(calls[0]?.args).toEqual(expect.arrayContaining([
      '--network', 'none', '--read-only', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges', 'node@sha256:test', 'node', 'script.mjs',
    ]));
    await lease.release();
  });
});
