import * as path from 'path';
import type { CommandContext } from '../context.js';
import { CliUserError } from '../errors.js';
import { scaffoldProject } from '../scaffolds/project.js';

const INIT_USAGE = 'fdekit init [name]';

export async function cmdInit(ctx: CommandContext): Promise<void> {
  const rawName = ctx.args[0];

  if (rawName?.startsWith('-')) {
    throw new CliUserError(`Project name cannot start with "-": ${rawName}`, {
      usage: INIT_USAGE,
      next: ['Pass a directory name, or omit [name] to scaffold in the current directory.'],
    });
  }

  if (ctx.args.length > 1) {
    throw new CliUserError(`Unknown init argument: ${ctx.args[1]}`, { usage: INIT_USAGE });
  }

  const projectDir = rawName ? path.resolve(ctx.cwd, rawName) : ctx.cwd;
  const name = rawName ?? path.basename(projectDir);

  await scaffoldProject(projectDir, name);

  console.log(`Created FDEKit project ${name} in ${projectDir}`);
  console.log(`Next steps:
  cd ${path.relative(ctx.cwd, projectDir) || '.'}
  npm install
  cp .env.example .env
  # Choose a live provider and add its key in .env, or keep mock for a smoke test.
  npm run agent`);
}
