import * as path from 'path';
import { asRecord, getString } from '@fdekit/core';
import {
  createArtifactStore,
  AgentRunError,
  loadDeployment,
  requireConfigFile,
  runAgent,
  type AgentRunResult,
  writeJsonArtifact,
} from '@fdekit/runtime';
import type { CommandContext } from '../context.js';
import { CliUserError } from '../errors.js';
import { builtinProviderRegistry } from '../providers/registry.js';

const RUN_USAGE = 'fdekit run <agent> [--ticket <id>] [--input <json-object>] [--max-steps <n>] [--strict]';

export async function cmdRun(ctx: CommandContext): Promise<void> {
  const agentName = ctx.args[0];

  if (!agentName) {
    console.error(`Usage: ${RUN_USAGE}`);
    process.exitCode = 1;
    return;
  }

  const options = parseRunArgs(ctx.args.slice(1));
  const configPath = await requireConfigFile(ctx.cwd);
  const projectDir = path.dirname(configPath);
  const deployment = await loadDeployment(configPath);
  const artifactStore = createArtifactStore({ deployment, projectDir });
  let result: AgentRunResult;

  try {
    result = await runAgent({
      deployment,
      projectDir,
      agentName,
      input: options.input,
      maxSteps: options.maxSteps,
      strict: options.strict,
      providerRegistry: builtinProviderRegistry,
      artifactStore,
    });
  } catch (err) {
    if (!(err instanceof AgentRunError)) {
      throw err;
    }

    const tracePath = await writeJsonArtifact(
      projectDir,
      'traces',
      `${err.result.trace.id}.json`,
      err.result.trace,
      artifactStore,
    );
    console.log(`Trace written: ${tracePath}`);
    throw err;
  }

  const tracePath = await writeJsonArtifact(projectDir, 'traces', `${result.trace.id}.json`, result.trace, artifactStore);

  for (const warning of collectRunWarnings(result.trace)) {
    console.warn(`Warning: ${warning}`);
  }

  console.log(`Agent: ${result.agent}`);
  console.log(`Status: ${result.status}`);
  console.log(`Tool calls: ${result.toolCalls.length > 0 ? result.toolCalls.map((call) => call.name).join(', ') : 'none'}`);
  if (result.approvals.length > 0) {
    console.log(`Approvals: ${result.approvals.map((approval) => `${approval.id} (${approval.status})`).join(', ')}`);
  }
  console.log(`Trace written: ${tracePath}`);
  console.log(`Final answer: ${result.finalAnswer}`);

  if (result.status !== 'completed') {
    if (result.status === 'waiting_approval') {
      const pending = result.approvals.find((approval) => approval.status === 'pending');

      if (pending) {
        console.log(`Next: fdekit approvals approve ${pending.id} --by <name> --reason "<reason>", then rerun this agent`);
      }
    }

    process.exitCode = 1;
  }
}

export function collectRunWarnings(trace: { events?: unknown[] }): string[] {
  return (trace.events ?? []).flatMap((event) => {
    const record = asRecord(event);

    if (record.type !== 'tool.call.failed' || record.toolName !== 'loadtest.run') {
      return [];
    }

    const error = asRecord(asRecord(record.result).error);
    const message = getString(error.message);

    if (!message?.includes('ENOENT')) {
      return [];
    }

    return [
      'k6 is required for measured load tests but was not found. '
      + 'Install it before using k6 mode (macOS: `brew install k6`) or set K6_BINARY. '
      + 'https://grafana.com/docs/k6/latest/set-up/install-k6/',
    ];
  });
}

function parseRunArgs(args: string[]): { input: Record<string, unknown>; maxSteps?: number; strict?: boolean } {
  const input: Record<string, unknown> = {};
  let maxSteps: number | undefined;
  let strict = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--ticket') {
      if (isMissingFlagValue(next)) {
        throw new CliUserError('Missing value for --ticket', { usage: RUN_USAGE });
      }

      input.ticketId = next;
      index += 1;
    } else if (arg === '--input') {
      if (isMissingFlagValue(next)) {
        throw new CliUserError('Missing value for --input', { usage: RUN_USAGE });
      }

      Object.assign(input, parseInputJson(next));
      index += 1;
    } else if (arg === '--max-steps') {
      if (isMissingFlagValue(next)) {
        throw new CliUserError('Missing value for --max-steps', { usage: RUN_USAGE });
      }

      maxSteps = Number(next);
      if (!Number.isInteger(maxSteps) || maxSteps < 1) {
        throw new CliUserError('--max-steps must be a positive integer', {
          usage: RUN_USAGE,
          next: ['Use a whole number greater than zero, for example `--max-steps 8`.'],
        });
      }

      index += 1;
    } else if (arg === '--strict') {
      strict = true;
    } else {
      throw new CliUserError(`Unknown run option: ${arg}`, { usage: RUN_USAGE });
    }
  }

  return { input, maxSteps, strict };
}

function isMissingFlagValue(value: string | undefined): boolean {
  return !value || value.startsWith('--');
}

function parseInputJson(value: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new CliUserError(`--input must be valid JSON: ${message}`, {
      usage: RUN_USAGE,
      next: ['Pass one quoted JSON object, for example `--input \'{"ticketId":"tick_1001"}\'`.'],
    });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CliUserError('--input must be a JSON object', {
      usage: RUN_USAGE,
      next: ['Use an object with named fields, for example `--input \'{"ticketId":"tick_1001"}\'`.'],
    });
  }

  return parsed as Record<string, unknown>;
}
