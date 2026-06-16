#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'url';
import { renderCliHelp, renderCommandHelp } from './catalog/docs.js';
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
import { fdekitCliVersion } from './package-versions.js';

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
  { names: ['version', '--version', '-v'], run: printVersion },
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
    const suggestion = suggestCommand(command);

    if (suggestion) {
      console.error(`Did you mean \`${suggestion}\`?`);
    }

    printHelp();
    process.exitCode = 1;
    return;
  }

  if (isHelpRequest(args)) {
    printCommandHelp(command);
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

function printVersion(): void {
  console.log(fdekitCliVersion);
}

function printCommandHelp(command: string): void {
  console.log(renderCommandHelp(command) ?? renderCliHelp());
}

function isHelpRequest(args: string[]): boolean {
  return args.includes('--help') || args.includes('-h');
}

function suggestCommand(command: string): string | undefined {
  const normalizedCommand = normalizeSuggestionInput(command);
  let best: { command: string; distance: number; startsSame: boolean } | undefined;

  for (const candidate of canonicalCommandNames()) {
    const normalizedCandidate = normalizeSuggestionInput(candidate);
    const distance = levenshteinDistance(normalizedCommand, normalizedCandidate);
    const startsSame = normalizedCommand[0] === normalizedCandidate[0];

    if (!best || distance < best.distance || (distance === best.distance && startsSame && !best.startsSame)) {
      best = { command: candidate, distance, startsSame };
    }
  }

  if (!best || best.distance > maxSuggestionDistance(normalizedCommand)) {
    return undefined;
  }

  return best.command;
}

function canonicalCommandNames(): string[] {
  return commandStrategies.map((strategy) => strategy.names[0]);
}

function normalizeSuggestionInput(value: string): string {
  return value.replace(/^-+/, '').toLowerCase();
}

function maxSuggestionDistance(value: string): number {
  if (value.length <= 3) {
    return 2;
  }

  if (value.length <= 8) {
    return 2;
  }

  return 3;
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

if (isDirectRun()) {
  runCli(process.argv.slice(2)).catch(handleCliError);
}

export function isDirectRun(): boolean {
  const entrypoint = process.argv[1];

  if (!entrypoint) {
    return false;
  }

  try {
    return realpathSync(entrypoint) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
