import * as path from 'path';
import { asRecord, getString } from '@fdekit/core';
import {
  createArtifactStore,
  AgentRunError,
  loadDeployment,
  requireConfigFile,
  resumeAgentRun,
  runAgent,
  type AgentRunResult,
  writeJsonArtifact,
} from '@fdekit/runtime';
import type { CommandContext } from '../context.js';
import { CliUserError } from '../errors.js';
import { builtinProviderRegistry } from '../providers/registry.js';

const RUN_USAGE = 'fdekit run <agent> [--ticket <id>] [--input <json-object>] [--max-steps <n>] [--strict] [--resume [runId]]';

/** Distinct exit code for "paused for a human decision" so scripts and CI can tell it from failure. */
export const WAITING_APPROVAL_EXIT_CODE = 2;

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
    result = options.resume
      ? await resumeAgentRun({
        deployment,
        projectDir,
        runId: options.resume.runId,
        agentName,
        strict: options.strict,
        providerRegistry: builtinProviderRegistry,
        artifactStore,
      })
      : await runAgent({
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

  const failedCalls = result.toolCalls.filter((call) => call.is_error);

  console.log(`Agent: ${result.agent}`);
  console.log(`Status: ${result.status}`);
  console.log(`Tool calls: ${result.toolCalls.length > 0 ? result.toolCalls.map(describeToolCall).join(', ') : 'none'}`);

  if (failedCalls.length > 0) {
    console.log(`Failed tool calls: ${failedCalls.length}`);

    for (const call of failedCalls) {
      console.log(`  ✗ ${call.name}: ${toolCallErrorMessage(call.result)}`);
    }
  }

  if (result.approvals.length > 0) {
    console.log(`Approvals: ${result.approvals.map((approval) => `${approval.id} (${approval.status})`).join(', ')}`);
  }
  console.log(`Trace written: ${tracePath}`);
  console.log(`Final answer: ${result.finalAnswer}`);

  if (result.status === 'completed_with_errors') {
    console.log('Run completed, but one or more tool calls failed; see the failures above and the trace for details.');
  }

  if (result.status === 'rejected') {
    const rejected = result.approvals.find((approval) => approval.status === 'rejected');
    console.log(`Run stopped: approval ${rejected ? `${rejected.id} for ${rejected.toolName} ` : ''}was rejected. This decision is final unless it is changed with --force.`);
  }

  if (result.status === 'waiting_approval') {
    const pending = result.approvals.find((approval) => approval.status === 'pending');

    if (pending) {
      console.log(`Next: fdekit approvals approve ${pending.id} --by <name> --reason "<reason>", then continue with: fdekit run ${result.agent} --resume ${result.id}`);
    }

    process.exitCode = WAITING_APPROVAL_EXIT_CODE;
    return;
  }

  if (result.status !== 'completed') {
    process.exitCode = 1;
  }
}

function describeToolCall(call: { name: string; is_error?: boolean }): string {
  return call.is_error ? `${call.name} (FAILED)` : call.name;
}

function toolCallErrorMessage(result: unknown): string {
  const error = asRecord(asRecord(result).error);
  return getString(error.message) ?? 'unknown error';
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

interface ParsedRunArgs {
  input: Record<string, unknown>;
  maxSteps?: number;
  strict?: boolean;
  resume?: { runId?: string };
}

function parseRunArgs(args: string[]): ParsedRunArgs {
  const input: Record<string, unknown> = {};
  let maxSteps: number | undefined;
  let strict = false;
  let resume: { runId?: string } | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--resume') {
      resume = { runId: isMissingFlagValue(next) ? undefined : next };

      if (resume.runId !== undefined) {
        index += 1;
      }
    } else if (arg === '--ticket') {
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

  if (resume && Object.keys(input).length > 0) {
    throw new CliUserError('--resume continues a paused run with its original input; it cannot be combined with --ticket or --input', {
      usage: RUN_USAGE,
    });
  }

  return { input, maxSteps, strict, resume };
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
