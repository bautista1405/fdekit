import * as path from 'path';
import {
  createArtifactStore,
  loadDeployment,
  readJsonArtifact,
  readJsonArtifacts,
  renderMacroEvalReport,
  requireConfigFile,
  runEvals,
  runMacroEvals,
  writeTextArtifact,
  writeJsonArtifact,
  type EvalArtifact,
  type TraceArtifact,
} from '@fdekit/runtime';
import type { CommandContext } from '../context.js';
import { CliUserError } from '../errors.js';
import { builtinProviderRegistry } from '../providers/registry.js';

const EVAL_USAGE = 'fdekit eval <run|macro> [--min-frequency <n>]';

export async function cmdEval(ctx: CommandContext): Promise<void> {
  const [subcommand, ...args] = ctx.args;

  if (subcommand !== 'run' && subcommand !== 'macro') {
    console.error(`Usage: ${EVAL_USAGE}`);
    process.exitCode = 1;
    return;
  }

  const macroOptions = subcommand === 'macro' ? parseMacroOptions(args) : null;
  if (subcommand === 'run' && args.length > 0) {
    throw new CliUserError(`Unknown eval run option: ${args[0]}`, { usage: EVAL_USAGE });
  }

  const configPath = await requireConfigFile(ctx.cwd);
  const deployment = await loadDeployment(configPath);
  const projectDir = path.dirname(configPath);
  const artifactStore = createArtifactStore({ deployment, projectDir });

  if (subcommand === 'macro') {
    const traces = await readJsonArtifacts<TraceArtifact>(projectDir, 'traces', artifactStore);
    const latestEval = await readJsonArtifact<EvalArtifact>(projectDir, 'evals', 'latest.json', artifactStore);
    const artifact = runMacroEvals({
      deployment,
      traces,
      evalArtifact: latestEval,
      minFrequency: macroOptions?.minFrequency ?? 1,
    });
    const latestPath = await writeJsonArtifact(projectDir, 'evals/macro', 'latest.json', artifact, artifactStore);
    const artifactPath = await writeJsonArtifact(projectDir, 'evals/macro', `${artifact.id}.json`, artifact, artifactStore);
    const reportPath = await writeTextArtifact(projectDir, 'evals/macro', 'report.md', renderMacroEvalReport(artifact), artifactStore);

    console.log(`Macro eval patterns: ${artifact.patterns.length}`);
    console.log(`Traces analyzed: ${artifact.traceDocuments.length}`);
    console.log(`Focus pattern: ${artifact.focusPattern?.behaviorPattern ?? 'none'}`);
    console.log(`Results written: ${latestPath}`);
    console.log(`Snapshot written: ${artifactPath}`);
    console.log(`Report written: ${reportPath}`);
    return;
  }

  const artifact = await runEvals({
    deployment,
    projectDir,
    writeTraces: true,
    providerRegistry: builtinProviderRegistry,
    artifactStore,
  });
  const latestPath = await writeJsonArtifact(projectDir, 'evals', 'latest.json', artifact, artifactStore);

  await writeJsonArtifact(projectDir, 'evals', `${artifact.id}.json`, artifact, artifactStore);

  console.log(`Eval status: ${artifact.status}`);
  console.log(`Eval suites: ${artifact.results.length}`);
  console.log(`Results written: ${latestPath}`);

  if (artifact.status !== 'passed') {
    process.exitCode = 1;
  }
}

function parseMacroOptions(args: string[]): { minFrequency: number } {
  let minFrequency = 1;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg !== '--min-frequency') {
      throw new CliUserError(`Unknown eval macro option: ${arg}`, { usage: EVAL_USAGE });
    }

    if (isMissingFlagValue(next)) {
      throw new CliUserError('Missing value for --min-frequency', { usage: EVAL_USAGE });
    }

    const parsed = Number(next);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new CliUserError('--min-frequency must be a positive integer', {
        usage: EVAL_USAGE,
        next: ['Use a whole number greater than zero, for example `--min-frequency 2`.'],
      });
    }

    minFrequency = parsed;
    index += 1;
  }

  return { minFrequency };
}

function isMissingFlagValue(value: string | undefined): boolean {
  return !value || value.startsWith('--');
}
