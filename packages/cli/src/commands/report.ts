import * as path from 'path';
import {
  createArtifactStore,
  loadDeployment,
  readJsonArtifact,
  readJsonArtifacts,
  renderReport,
  requireConfigFile,
  writeTextArtifact,
  type EvalArtifact,
  type TraceArtifact,
} from '@fdekit/runtime';
import type { CommandContext } from '../context.js';

export async function cmdReport(ctx: CommandContext): Promise<void> {
  const configPath = await requireConfigFile(ctx.cwd);
  const projectDir = path.dirname(configPath);
  const deployment = await loadDeployment(configPath);
  const artifactStore = createArtifactStore({ deployment, projectDir });
  const latestEval = await readJsonArtifact<EvalArtifact>(projectDir, 'evals', 'latest.json', artifactStore);
  const traces = await readJsonArtifacts<TraceArtifact>(projectDir, 'traces', artifactStore);
  const report = renderReport(deployment, latestEval, traces);
  const reportPath = await writeTextArtifact(projectDir, 'reports', 'deployment-report.md', report, artifactStore);

  console.log(`Report written: ${reportPath}`);
}
