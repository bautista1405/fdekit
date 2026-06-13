import * as path from 'path';
import {
  createArtifactStore,
  loadDeployment,
  readAuditLog,
  requireConfigFile,
  type AuditLogEntry,
} from '@fdekit/runtime';
import type { CommandContext } from '../context.js';
import { CliUserError } from '../errors.js';

const AUDIT_USAGE = 'fdekit audit [--limit <n>]';

export async function cmdAudit(ctx: CommandContext): Promise<void> {
  const limit = parseLimit(ctx.args);
  const configPath = await requireConfigFile(ctx.cwd);
  const projectDir = path.dirname(configPath);
  const deployment = await loadDeployment(configPath);
  const artifactStore = createArtifactStore({ deployment, projectDir });
  const entries = await readAuditLog(projectDir, artifactStore);

  if (entries.length === 0) {
    console.log('No audit log entries found');
    return;
  }

  const recent = entries.slice(-limit);
  console.log(`Audit log: ${recent.length}/${entries.length}`);

  for (const entry of recent) {
    console.log(formatAuditEntry(entry));
  }
}

function parseLimit(args: string[]): number {
  let limit = 20;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--limit') {
      if (isMissingFlagValue(next)) {
        throw new CliUserError('Missing value for --limit', { usage: AUDIT_USAGE });
      }

      limit = Number(next);
      if (!Number.isInteger(limit) || limit < 1) {
        throw new CliUserError('--limit must be a positive integer', {
          usage: AUDIT_USAGE,
          next: ['Use a whole number greater than zero, for example `--limit 50`.'],
        });
      }

      index += 1;
    } else {
      throw new CliUserError(`Unknown audit option: ${arg}`, { usage: AUDIT_USAGE });
    }
  }

  return limit;
}

function isMissingFlagValue(value: string | undefined): boolean {
  return !value || value.startsWith('--');
}

function formatAuditEntry(entry: AuditLogEntry): string {
  const qualifiers = [
    entry.toolName ? `tool=${entry.toolName}` : '',
    entry.policy ? `policy=${entry.policy}` : '',
    entry.approvalId ? `approval=${entry.approvalId}` : '',
    entry.message ? `message="${entry.message}"` : '',
  ].filter(Boolean).join(' ');

  return `${entry.createdAt} ${entry.outcome.padEnd(9)} ${entry.action} actor=${entry.actor}${qualifiers ? ` ${qualifiers}` : ''}`;
}
