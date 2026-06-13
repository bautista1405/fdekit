import * as path from 'path';
import type { CommandContext } from '../context.js';
import { scaffoldProject } from '../scaffolds/project.js';

export async function cmdInit(ctx: CommandContext): Promise<void> {
  const rawName = ctx.args[0];
  const projectDir = rawName ? path.resolve(ctx.cwd, rawName) : ctx.cwd;
  const name = rawName ?? path.basename(projectDir);

  await scaffoldProject(projectDir, name);

  console.log(`Created FDEKit project ${name} in ${projectDir}`);
  console.log(`Next steps:
  cd ${path.relative(ctx.cwd, projectDir) || '.'}
  fdekit dev
  fdekit eval run
  fdekit report`);
}
