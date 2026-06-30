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
import type { DeploymentDefinition } from '@fdekit/core';
import type { CommandContext } from '../context.js';
import { CliUserError } from '../errors.js';
import { builtinProviderRegistry } from '../providers/registry.js';

const EVAL_USAGE = 'fdekit eval <run [target]|macro [--min-frequency <n>]>';

export async function cmdEval(ctx: CommandContext): Promise<void> {
  const [subcommand, ...args] = ctx.args;

  if (subcommand !== 'run' && subcommand !== 'macro') {
    console.error(`Usage: ${EVAL_USAGE}`);
    process.exitCode = 1;
    return;
  }

  const macroOptions = subcommand === 'macro' ? parseMacroOptions(args) : null;
  const runTarget = subcommand === 'run' ? parseRunTarget(args) : undefined;

  const configPath = await requireConfigFile(ctx.cwd);
  const deployment = await loadDeployment(configPath);
  const evalDeployment = selectDeploymentEvalTarget(deployment, runTarget);
  const projectDir = path.dirname(configPath);
  const artifactStore = createArtifactStore({ deployment: evalDeployment, projectDir });

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
    deployment: evalDeployment,
    projectDir,
    writeTraces: true,
    providerRegistry: builtinProviderRegistry,
    artifactStore,
  });
  const latestPath = await writeJsonArtifact(projectDir, 'evals', 'latest.json', artifact, artifactStore);

  await writeJsonArtifact(projectDir, 'evals', `${artifact.id}.json`, artifact, artifactStore);

  console.log(`Eval status: ${artifact.status}`);
  if (runTarget) {
    console.log(`Eval target: ${runTarget}`);
  }
  console.log(`Eval suites: ${artifact.results.length}`);
  console.log(`Results written: ${latestPath}`);

  if (artifact.status !== 'passed') {
    process.exitCode = 1;
  }
}

function parseRunTarget(args: string[]): string | undefined {
  if (args.length === 0) {
    return undefined;
  }

  if (args.length > 1) {
    throw new CliUserError(`Unknown eval run option: ${args[1]}`, { usage: EVAL_USAGE });
  }

  const target = args[0];

  if (target.startsWith('--')) {
    throw new CliUserError(`Unknown eval run option: ${target}`, { usage: EVAL_USAGE });
  }

  return target;
}

function selectDeploymentEvalTarget(
  deployment: DeploymentDefinition,
  target: string | undefined,
): DeploymentDefinition {
  if (!target) {
    return deployment;
  }

  const deploymentEvals = (deployment.evals ?? []).filter((evalDefinition) => (
    evalDefinition.name === target
    || evalDefinition.agent === target
    || `deployment:${evalDefinition.name}` === target
  ));
  const agents = Object.fromEntries(Object.entries(deployment.agents ?? {}).map(([agentName, agent]) => [
    agentName,
    {
      ...agent,
      evals: (agent.evals ?? []).filter((evalDefinition) => (
        agentName === target
        || evalDefinition.name === target
        || evalDefinition.agent === target
        || `agent:${agentName}` === target
        || `agent:${agentName}:${evalDefinition.name}` === target
      )),
    },
  ]));
  const matchedAgentEvals = Object.values(agents)
    .reduce((total, agent) => total + (agent.evals?.length ?? 0), 0);

  if (deploymentEvals.length === 0 && matchedAgentEvals === 0) {
    throw new CliUserError(`No eval suites matched "${target}"`, {
      usage: EVAL_USAGE,
      next: ['Use an agent name, eval suite name, or eval scope from the current deployment.'],
    });
  }

  return {
    ...deployment,
    evals: deploymentEvals,
    agents,
  };
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
