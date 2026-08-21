import * as os from 'os';
import * as path from 'path';
import {
  ApprovalDecisionConflictError,
  approveApproval,
  createArtifactStore,
  loadDeployment,
  readApproval,
  readApprovals,
  rejectApproval,
  revisePausedApproval,
  requireConfigFile,
  type ArtifactStore,
  type ApprovalArtifact,
  type ApprovalStatus,
} from '@fdekit/runtime';
import type { DeploymentDefinition } from '@fdekit/core';
import type { CommandContext } from '../context.js';
import { CliUserError } from '../errors.js';

const APPROVALS_USAGE = 'fdekit approvals [list [--status <pending|approved|rejected|superseded>] [--tool <name>] [--json]|show <id> [--json]|edit <id> --args <json-object> [--by <actor>] [--reason <text>]|approve <id>|reject <id>] [--by <actor>] [--reason <text>] [--force]';

interface ArtifactCommandContext {
  projectDir: string;
  artifactStore: ArtifactStore;
  deployment: DeploymentDefinition;
}

export async function cmdApprovals(ctx: CommandContext): Promise<void> {
  const action = ctx.args[0] ?? 'list';

  if (action === 'list') {
    await listApprovals(ctx);
    return;
  }

  if (action === 'show') {
    await showApproval(ctx);
    return;
  }

  if (action === 'edit') {
    await editApproval(ctx);
    return;
  }

  if (action === 'approve' || action === 'reject') {
    await decideApproval(ctx, action);
    return;
  }

  console.error(`Usage: ${APPROVALS_USAGE}`);
  process.exitCode = 1;
}

async function editApproval(ctx: CommandContext): Promise<void> {
  const id = ctx.args[1];
  if (!id || id.startsWith('--')) {
    throw new CliUserError('Approval id is required', { usage: APPROVALS_USAGE });
  }
  const options = parseEditOptions(ctx.args.slice(2));
  const actor = options.actor ?? osUsername();
  const { projectDir, artifactStore, deployment } = await resolveArtifactContext(ctx.cwd);
  const revised = await revisePausedApproval({
    deployment,
    projectDir,
    artifactStore,
    approvalId: id,
    args: options.args,
    actor,
    reason: options.reason,
  });
  console.log(`Approval revised: ${revised.previous.id} -> ${revised.current.id}`);
  console.log(`Tool: ${revised.current.toolName}`);
  console.log(`Args: ${JSON.stringify(revised.current.args)}`);
  console.log(`Next: fdekit approvals approve ${revised.current.id} --by <name> --reason "<reason>"`);
}

async function listApprovals(ctx: CommandContext): Promise<void> {
  const options = parseListOptions(ctx.args.slice(1));
  const { projectDir, artifactStore } = await resolveArtifactContext(ctx.cwd);
  const approvals = sortApprovals(await readApprovals(projectDir, artifactStore))
    .filter((approval) => !options.status || approval.status === options.status)
    .filter((approval) => !options.tool || approval.toolName === options.tool);

  if (options.json) {
    console.log(JSON.stringify(approvals, null, 2));
    return;
  }

  if (approvals.length === 0) {
    console.log(options.status || options.tool ? 'No approval requests matched the filters' : 'No approval requests found');
    return;
  }

  console.log(`Approvals: ${approvals.length}`);

  for (const approval of approvals) {
    console.log(`${approval.status.padEnd(8)} ${approval.id} ${approval.toolName} (${approval.policy})`);
    console.log(`  Args: ${summarizeArgs(approval.args)}`);

    const target = summarizeTarget(approval.target);
    if (target) {
      console.log(`  Target: ${target}`);
    }

    console.log(`  Reason: ${approval.reason}`);
    console.log(`  Requested: ${approval.createdAt} by ${approval.requestedBy}`);

    if (approval.decidedAt) {
      console.log(`  Decided: ${approval.decidedAt} by ${approval.decidedBy ?? 'unknown'}${approval.decisionReason ? ` - ${approval.decisionReason}` : ''}`);
    }

    if (approval.executedAt) {
      console.log(`  Executed: ${approval.executedAt}${approval.executedRunId ? ` in run ${approval.executedRunId}` : ''}`);
    }
  }

  const pendingCount = approvals.filter((approval) => approval.status === 'pending').length;

  if (pendingCount > 0) {
    console.log(`\nNext: fdekit approvals show <id> to inspect a request, or fdekit approvals approve <id> --by <name> --reason "<reason>"`);
  }
}

async function showApproval(ctx: CommandContext): Promise<void> {
  const id = ctx.args[1];

  if (!id || id.startsWith('--')) {
    console.error('Usage: fdekit approvals show <id> [--json]');
    process.exitCode = 1;
    return;
  }

  const json = parseShowOptions(ctx.args.slice(2));
  const { projectDir, artifactStore } = await resolveArtifactContext(ctx.cwd);
  const approval = await readApproval(projectDir, id, artifactStore);

  if (!approval) {
    throw new CliUserError(`Approval request not found: ${id}`, {
      next: ['Run `fdekit approvals list` to see available approval ids.'],
    });
  }

  if (json) {
    console.log(JSON.stringify(approval, null, 2));
    return;
  }

  console.log(`Approval: ${approval.id}`);
  console.log(`Status: ${approval.status}`);
  console.log(`Tool: ${approval.toolName}`);
  console.log(`Policy: ${approval.policy}`);
  console.log(`Phase: ${approval.phase}`);
  console.log(`Deployment: ${approval.deployment}${approval.environment ? ` (${approval.environment})` : ''}`);
  console.log(`Agent: ${approval.agent}`);
  console.log(`Run: ${approval.runId}`);
  console.log(`Reason: ${approval.reason}`);
  console.log(`Requested: ${approval.createdAt} by ${approval.requestedBy}`);

  if (approval.target && Object.keys(approval.target).length > 0) {
    console.log('\nTarget');
    for (const [key, value] of Object.entries(approval.target)) {
      console.log(`  ${key}: ${String(value)}`);
    }
  }

  console.log('\nArgs');
  console.log(indentBlock(JSON.stringify(approval.args ?? {}, null, 2), '  '));

  if (approval.decisions?.length) {
    console.log('\nDecisions');
    for (const decision of approval.decisions) {
      console.log(`  ${decision.status} by ${decision.decidedBy} at ${decision.decidedAt}${decision.reason ? ` - ${decision.reason}` : ''}`);
    }
  }

  if (approval.executedAt) {
    console.log(`\nExecuted: ${approval.executedAt}${approval.executedRunId ? ` in run ${approval.executedRunId}` : ''}`);
  }

  if (approval.status === 'pending') {
    console.log(`\nNext: fdekit approvals approve ${approval.id} --by <name> --reason "<reason>"`);
  }
}

async function decideApproval(ctx: CommandContext, action: 'approve' | 'reject'): Promise<void> {
  const id = ctx.args[1];

  if (!id) {
    console.error(`Usage: fdekit approvals ${action} <id> [--by <actor>] [--reason <text>] [--force]`);
    process.exitCode = 1;
    return;
  }

  const options = parseDecisionOptions(ctx.args.slice(2));
  const actor = options.actor ?? osUsername();
  const { projectDir, artifactStore } = await resolveArtifactContext(ctx.cwd);
  let approval: ApprovalArtifact;

  try {
    approval = action === 'approve'
      ? await approveApproval(projectDir, id, { ...options, actor }, artifactStore)
      : await rejectApproval(projectDir, id, { ...options, actor }, artifactStore);
  } catch (err) {
    if (err instanceof ApprovalDecisionConflictError) {
      throw new CliUserError(
        `Approval ${err.approval.id} is already ${err.approval.status} (by ${err.approval.decidedBy ?? 'unknown'} at ${err.approval.decidedAt ?? 'unknown time'})`,
        {
          next: [
            `To change the recorded decision, re-run with --force: fdekit approvals ${action} ${id} --by <name> --reason "<reason>" --force`,
            'The artifact keeps the full decision history either way.',
          ],
        },
      );
    }

    throw err;
  }

  console.log(`Approval ${approval.status}: ${approval.id}`);
  console.log(`Tool: ${approval.toolName}`);
  console.log(`Policy: ${approval.policy}`);
  console.log(`Decided by: ${approval.decidedBy}${options.actor ? '' : ' (OS user; pass --by to record a different actor)'}`);

  if (approval.decisionReason) {
    console.log(`Reason: ${approval.decisionReason}`);
  }

  if ((approval.decisions?.length ?? 0) > 1) {
    console.log(`Decision history: ${(approval.decisions ?? []).map((decision) => `${decision.status} by ${decision.decidedBy}`).join(' -> ')}`);
  }

  if (approval.status === 'approved') {
    console.log(`Next: fdekit run ${approval.agent} --resume ${approval.runId}`);
  }
}

function osUsername(): string {
  try {
    return os.userInfo().username || 'fde';
  } catch {
    return process.env.USER || process.env.USERNAME || 'fde';
  }
}

function summarizeArgs(args: unknown, maxLength = 120): string {
  let serialized: string;

  try {
    serialized = JSON.stringify(args) ?? 'none';
  } catch {
    serialized = String(args);
  }

  if (serialized === '{}' || serialized === 'null' || serialized === 'undefined') {
    return 'none';
  }

  return serialized.length > maxLength
    ? `${serialized.slice(0, maxLength - 1)}… (run \`fdekit approvals show <id>\` for full args)`
    : serialized;
}

function summarizeTarget(target: Record<string, unknown> | undefined): string {
  if (!target) {
    return '';
  }

  return Object.entries(target)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
}

function indentBlock(value: string, indent: string): string {
  return value.split('\n').map((line) => `${indent}${line}`).join('\n');
}

function parseListOptions(args: string[]): { status?: ApprovalStatus; tool?: string; json: boolean } {
  const options: { status?: ApprovalStatus; tool?: string; json: boolean } = { json: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--status') {
      if (isMissingFlagValue(next)) {
        throw new CliUserError('Missing value for --status', { usage: APPROVALS_USAGE });
      }

      if (next !== 'pending' && next !== 'approved' && next !== 'rejected' && next !== 'superseded') {
        throw new CliUserError(`Invalid --status value: ${next}`, {
          usage: APPROVALS_USAGE,
          next: ['Use one of: pending, approved, rejected, superseded.'],
        });
      }

      options.status = next;
      index += 1;
    } else if (arg === '--tool') {
      if (isMissingFlagValue(next)) {
        throw new CliUserError('Missing value for --tool', { usage: APPROVALS_USAGE });
      }

      options.tool = next;
      index += 1;
    } else if (arg === '--json') {
      options.json = true;
    } else {
      throw new CliUserError(`Unknown approvals option: ${arg}`, { usage: APPROVALS_USAGE });
    }
  }

  return options;
}

function parseShowOptions(args: string[]): boolean {
  let json = false;

  for (const arg of args) {
    if (arg === '--json') {
      json = true;
    } else {
      throw new CliUserError(`Unknown approvals option: ${arg}`, { usage: APPROVALS_USAGE });
    }
  }

  return json;
}

function parseDecisionOptions(args: string[]): { actor?: string; reason?: string; force?: boolean } {
  const options: { actor?: string; reason?: string; force?: boolean } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--by') {
      if (isMissingFlagValue(next)) {
        throw new CliUserError('Missing value for --by', { usage: APPROVALS_USAGE });
      }

      options.actor = next;
      index += 1;
    } else if (arg === '--reason') {
      if (isMissingFlagValue(next)) {
        throw new CliUserError('Missing value for --reason', { usage: APPROVALS_USAGE });
      }

      options.reason = next;
      index += 1;
    } else if (arg === '--force') {
      options.force = true;
    } else {
      throw new CliUserError(`Unknown approvals option: ${arg}`, { usage: APPROVALS_USAGE });
    }
  }

  return options;
}

function parseEditOptions(args: string[]): { args: Record<string, unknown>; actor?: string; reason?: string } {
  let replacementArgs: Record<string, unknown> | undefined;
  let actor: string | undefined;
  let reason: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === '--args') {
      if (isMissingFlagValue(next)) throw new CliUserError('Missing value for --args', { usage: APPROVALS_USAGE });
      let value: unknown;
      try {
        value = JSON.parse(next);
      } catch {
        throw new CliUserError('--args must be valid JSON', { usage: APPROVALS_USAGE });
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new CliUserError('--args must be a JSON object', { usage: APPROVALS_USAGE });
      }
      replacementArgs = value as Record<string, unknown>;
      index += 1;
    } else if (arg === '--by') {
      if (isMissingFlagValue(next)) throw new CliUserError('Missing value for --by', { usage: APPROVALS_USAGE });
      actor = next;
      index += 1;
    } else if (arg === '--reason') {
      if (isMissingFlagValue(next)) throw new CliUserError('Missing value for --reason', { usage: APPROVALS_USAGE });
      reason = next;
      index += 1;
    } else {
      throw new CliUserError(`Unknown approvals edit option: ${arg}`, { usage: APPROVALS_USAGE });
    }
  }
  if (!replacementArgs) throw new CliUserError('approvals edit requires --args <json-object>', { usage: APPROVALS_USAGE });
  return { args: replacementArgs, actor, reason };
}

function isMissingFlagValue(value: string | undefined): boolean {
  return !value || value.startsWith('--');
}

function sortApprovals(approvals: ApprovalArtifact[]): ApprovalArtifact[] {
  const statusRank: Record<ApprovalArtifact['status'], number> = {
    pending: 0,
    rejected: 1,
    approved: 2,
    superseded: 3,
  };

  return [...approvals].sort((left, right) => {
    const status = statusRank[left.status] - statusRank[right.status];
    return status || right.createdAt.localeCompare(left.createdAt);
  });
}

async function resolveArtifactContext(cwd: string): Promise<ArtifactCommandContext> {
  const configPath = await requireConfigFile(cwd);
  const projectDir = path.dirname(configPath);
  const deployment = await loadDeployment(configPath);

  return {
    projectDir,
    artifactStore: createArtifactStore({ deployment, projectDir }),
    deployment,
  };
}
