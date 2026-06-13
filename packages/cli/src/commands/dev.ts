import * as path from 'path';
import {
  createArtifactStore,
  createDevTrace,
  joinNames,
  loadDeployment,
  requireConfigFile,
  writeJsonArtifact,
} from '@fdekit/runtime';
import type { CommandContext } from '../context.js';

export async function cmdDev(ctx: CommandContext): Promise<void> {
  const configPath = await requireConfigFile(ctx.cwd);
  const projectDir = path.dirname(configPath);
  const deployment = await loadDeployment(configPath);
  const artifactStore = createArtifactStore({ deployment, projectDir });
  const trace = createDevTrace(deployment);
  const tracePath = await writeJsonArtifact(projectDir, 'traces', `${trace.id}.json`, trace, artifactStore);

  console.log(`Loaded deployment: ${deployment.name}`);
  console.log(`Providers: ${joinNames(Object.keys(deployment.providers ?? {}))}`);
  console.log(`Connectors: ${joinNames(Object.keys(deployment.connectors ?? {}))}`);
  console.log(`Agents: ${joinNames(Object.keys(deployment.agents ?? {}))}`);
  console.log(`Trace written: ${tracePath}`);
}
