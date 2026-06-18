import { promises as fs } from 'fs';
import * as path from 'path';
import {
  createArtifactStore,
  createDeploymentSnapshot,
  diffDeploymentSnapshots,
  loadDeployment,
  readJsonArtifact,
  requireConfigFile,
  type DeploymentDiff,
  type DeploymentDiffChange,
  type DeploymentSnapshot,
} from '@fdekit/runtime';
import type { CommandContext } from '../context.js';
import { CliUserError } from '../errors.js';

const DIFF_USAGE = 'fdekit diff [--from <snapshot-or-config>] [--to <snapshot-or-config>] [--json]';

interface DiffOptions {
  json: boolean;
  from?: string;
  to?: string;
}

export async function cmdDiff(ctx: CommandContext): Promise<void> {
  const options = parseDiffArgs(ctx.args);
  const configPath = await requireConfigFile(ctx.cwd);
  const projectDir = path.dirname(configPath);
  const deployment = await loadDeployment(configPath);
  const artifactStore = createArtifactStore({ deployment, projectDir });
  const fromArg = options.from;
  const toArg = options.to;
  const fromPath = fromArg ? path.resolve(ctx.cwd, fromArg) : artifactStore.uri({ group: 'deployments', fileName: 'latest.json' });
  const toPath = toArg ? path.resolve(ctx.cwd, toArg) : configPath;
  const from = fromArg
    ? await loadSnapshotInput(fromPath)
    : await loadStoredSnapshot(projectDir, artifactStore);
  const to = toArg ? await loadSnapshotInput(toPath) : createDeploymentSnapshot(deployment);
  const diff = diffDeploymentSnapshots(from, to);

  if (options.json) {
    console.log(JSON.stringify(diff, null, 2));
    return;
  }

  printDiff(diff, fromPath, toPath);
}

async function loadStoredSnapshot(
  projectDir: string,
  artifactStore: ReturnType<typeof createArtifactStore>,
): Promise<DeploymentSnapshot> {
  const snapshot = await readJsonArtifact<DeploymentSnapshot>(projectDir, 'deployments', 'latest.json', artifactStore);

  if (!isSnapshot(snapshot)) {
    throw new CliUserError(`Could not read deployment snapshot at ${artifactStore.uri({ group: 'deployments', fileName: 'latest.json' })}`, {
      usage: DIFF_USAGE,
      next: ['Run `fdekit validate` first, or pass `--from <snapshot>` to compare against a specific snapshot.'],
    });
  }

  return snapshot;
}

async function loadSnapshotInput(filePath: string): Promise<DeploymentSnapshot> {
  if (filePath.endsWith('.json')) {
    return readSnapshot(filePath);
  }

  const deployment = await loadDeployment(filePath);
  return createDeploymentSnapshot(deployment);
}

async function readSnapshot(filePath: string): Promise<DeploymentSnapshot> {
  let value: unknown;

  try {
    value = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new CliUserError(`Could not read deployment snapshot at ${filePath}: ${message}`, {
      usage: DIFF_USAGE,
      next: ['Pass a JSON snapshot written by `fdekit validate`, or pass a config file path instead.'],
    });
  }

  if (!isSnapshot(value)) {
    throw new CliUserError(`File is not a FDEKit deployment snapshot: ${filePath}`, {
      usage: DIFF_USAGE,
      next: ['Use a snapshot from `artifacts/deployments/snapshots`, or pass a config file path.'],
    });
  }

  return value;
}

function printDiff(diff: DeploymentDiff, fromPath: string, toPath: string): void {
  console.log('FDEKit diff');
  console.log(`From: ${fromPath}`);
  console.log(`To: ${toPath}`);
  console.log('');

  if (diff.changes.length === 0) {
    console.log('No deployment changes found');
    return;
  }

  for (const change of diff.changes) {
    console.log(formatChange(change));
  }
}

function formatChange(change: DeploymentDiffChange): string {
  if (change.kind === 'added') {
    return `+ ${change.path}: ${formatValue(change.after)}`;
  }

  if (change.kind === 'removed') {
    return `- ${change.path}: ${formatValue(change.before)}`;
  }

  return `~ ${change.path}: ${formatValue(change.before)} -> ${formatValue(change.after)}`;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return JSON.stringify(value);
  }

  return JSON.stringify(value);
}

function isSnapshot(value: unknown): value is DeploymentSnapshot {
  return Boolean(value)
    && typeof value === 'object'
    && (value as DeploymentSnapshot).schemaVersion === 1
    && Boolean((value as DeploymentSnapshot).deployment);
}

function parseDiffArgs(args: string[]): DiffOptions {
  const options: DiffOptions = { json: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--from' || arg === '--to') {
      if (!next || next.startsWith('--')) {
        throw new CliUserError(`Missing value for ${arg}`, { usage: DIFF_USAGE });
      }

      if (arg === '--from') {
        options.from = next;
      } else {
        options.to = next;
      }

      index += 1;
      continue;
    }

    throw new CliUserError(`Unknown diff option: ${arg}`, { usage: DIFF_USAGE });
  }

  return options;
}
