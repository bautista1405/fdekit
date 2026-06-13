import * as path from 'path';
import {
  createArtifactStore,
  findConfigFile,
  findProjectDir,
  loadDeployment,
  readJsonArtifacts,
  renderTraceViewer,
  writeTextArtifact,
  type TraceArtifact,
} from '@fdekit/runtime';
import type { CommandContext } from '../context.js';

export async function cmdTrace(ctx: CommandContext): Promise<void> {
  const configPath = await findConfigFile(ctx.cwd);
  const projectDir = configPath ? path.dirname(configPath) : await findProjectDir(ctx.cwd);
  const deployment = configPath ? await loadDeployment(configPath) : undefined;
  const artifactStore = createArtifactStore({ deployment, projectDir });
  const traces = await readJsonArtifacts<TraceArtifact>(projectDir, 'traces', artifactStore);
  const viewerPath = await writeTextArtifact(projectDir, '', 'trace-viewer.html', renderTraceViewer(traces), artifactStore);

  console.log(`Trace viewer created: ${viewerPath}`);
  console.log(`Traces loaded: ${traces.length}`);
}
