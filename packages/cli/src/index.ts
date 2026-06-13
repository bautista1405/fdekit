#!/usr/bin/env node
import * as path from 'path';
import { fileURLToPath } from 'url';
import { renderCliHelp } from './catalog/docs.js';
import { cmdAdd } from './commands/add.js';
import { cmdApprovals } from './commands/approvals.js';
import { cmdAudit } from './commands/audit.js';
import { cmdConsole } from './commands/console.js';
import { cmdDev } from './commands/dev.js';
import { cmdDiff } from './commands/diff.js';
import { cmdDoctor } from './commands/doctor.js';
import { cmdEnv } from './commands/env.js';
import { cmdEval } from './commands/eval.js';
import { cmdFeedback } from './commands/feedback.js';
import { cmdInit } from './commands/init.js';
import { cmdRecipe } from './commands/recipe.js';
import { cmdReport } from './commands/report.js';
import { cmdRun } from './commands/run.js';
import { cmdTrace } from './commands/trace.js';
import { cmdValidate } from './commands/validate.js';
import type { CommandContext } from './context.js';
import { printCliError } from './errors.js';

interface CommandStrategy {
  names: readonly string[];
  run: (ctx: CommandContext) => Promise<void> | void;
}

const commandStrategies: CommandStrategy[] = [
  { names: ['init'], run: cmdInit },
  { names: ['add'], run: cmdAdd },
  { names: ['approvals'], run: cmdApprovals },
  { names: ['audit'], run: cmdAudit },
  { names: ['console'], run: cmdConsole },
  { names: ['dev'], run: cmdDev },
  { names: ['diff'], run: cmdDiff },
  { names: ['doctor'], run: cmdDoctor },
  { names: ['env'], run: cmdEnv },
  { names: ['trace'], run: cmdTrace },
  { names: ['validate'], run: cmdValidate },
  { names: ['eval'], run: cmdEval },
  { names: ['feedback'], run: cmdFeedback },
  { names: ['report'], run: cmdReport },
  { names: ['run'], run: cmdRun },
  { names: ['recipe'], run: cmdRecipe },
  { names: ['help', '--help', '-h'], run: printHelp },
];

export async function runCli(argv: string[], cwd = process.cwd()): Promise<void> {
  if (argv.length === 0) {
    printHelp();
    return;
  }

  const command = argv[0];
  const args = argv.slice(1);
  const ctx: CommandContext = { cwd, args };
  const strategy = commandStrategies.find((candidate) => candidate.names.includes(command));

  if (!strategy) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  await strategy.run(ctx);
}

export function handleCliError(err: unknown): void {
  printCliError(err);
  process.exitCode = 1;
}

function printHelp(): void {
  console.log(renderCliHelp());
}

if (isDirectRun()) {
  runCli(process.argv.slice(2)).catch(handleCliError);
}

function isDirectRun(): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint) && path.resolve(entrypoint) === fileURLToPath(import.meta.url);
}
