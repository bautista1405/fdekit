import * as path from 'path';
import {
  approveApproval,
  createArtifactStore,
  loadDeployment,
  readApprovals,
  rejectApproval,
  requireConfigFile,
  type ArtifactStore,
  type ApprovalArtifact,
} from '@fdekit/runtime';
import type { CommandContext } from '../context.js';
import { CliUserError } from '../errors.js';

const APPROVALS_USAGE = 'fdekit approvals [list|approve <id>|reject <id>] [--by <actor>] [--reason <text>]';

interface ArtifactCommandContext {
  projectDir: string;
  artifactStore: ArtifactStore;
}

export async function cmdApprovals(ctx: CommandContext): Promise<void> {
  const action = ctx.args[0] ?? 'list';

  if (action === 'list') {
    await listApprovals(ctx);
    return;
  }

  if (action === 'approve' || action === 'reject') {
    await decideApproval(ctx, action);
    return;
  }

  console.error(`Usage: ${APPROVALS_USAGE}`);
  process.exitCode = 1;
}

async function listApprovals(ctx: CommandContext): Promise<void> {
  const { projectDir, artifactStore } = await resolveArtifactContext(ctx.cwd);
  const approvals = sortApprovals(await readApprovals(projectDir, artifactStore));

  if (approvals.length === 0) {
    console.log('No approval requests found');
    return;
  }

  console.log(`Approvals: ${approvals.length}`);

  for (const approval of approvals) {
    console.log(`${approval.status.padEnd(8)} ${approval.id} ${approval.toolName} (${approval.policy})`);
    console.log(`  Reason: ${approval.reason}`);
    console.log(`  Requested: ${approval.createdAt} by ${approval.requestedBy}`);

    if (approval.decidedAt) {
      console.log(`  Decided: ${approval.decidedAt} by ${approval.decidedBy ?? 'unknown'}${approval.decisionReason ? ` - ${approval.decisionReason}` : ''}`);
    }
  }
}

async function decideApproval(ctx: CommandContext, action: 'approve' | 'reject'): Promise<void> {
  const id = ctx.args[1];

  if (!id) {
    console.error(`Usage: fdekit approvals ${action} <id> [--by <actor>] [--reason <text>]`);
    process.exitCode = 1;
    return;
  }

  const options = parseDecisionOptions(ctx.args.slice(2));
  const { projectDir, artifactStore } = await resolveArtifactContext(ctx.cwd);
  const approval = action === 'approve'
    ? await approveApproval(projectDir, id, options, artifactStore)
    : await rejectApproval(projectDir, id, options, artifactStore);

  console.log(`Approval ${approval.status}: ${approval.id}`);
  console.log(`Tool: ${approval.toolName}`);
  console.log(`Policy: ${approval.policy}`);

  if (approval.decisionReason) {
    console.log(`Reason: ${approval.decisionReason}`);
  }
}

function parseDecisionOptions(args: string[]): { actor?: string; reason?: string } {
  const options: { actor?: string; reason?: string } = {};

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
    } else {
      throw new CliUserError(`Unknown approvals option: ${arg}`, { usage: APPROVALS_USAGE });
    }
  }

  return options;
}

function isMissingFlagValue(value: string | undefined): boolean {
  return !value || value.startsWith('--');
}

function sortApprovals(approvals: ApprovalArtifact[]): ApprovalArtifact[] {
  const statusRank: Record<ApprovalArtifact['status'], number> = {
    pending: 0,
    rejected: 1,
    approved: 2,
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
  };
}
