import { findProjectDir } from '@fdekit/runtime';
import type { CommandContext } from '../context.js';
import { findBuiltinRecipe } from '../scaffolds/index.js';
import { captureLocalRecipe } from './recipe/capture.js';
import {
  installCapturedRecipe,
  resolveLocalRecipe,
} from './recipe/install.js';

export async function cmdRecipe(ctx: CommandContext): Promise<void> {
  const [subcommand, recipeName, ...rest] = ctx.args;

  if (!subcommand || !recipeName || !['install', 'capture'].includes(subcommand)) {
    console.error('Usage: fdekit recipe <install|capture> <name-or-path>');
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'capture') {
    await captureLocalRecipe(ctx, recipeName, rest.includes('--force'));
    return;
  }

  const builtinRecipe = findBuiltinRecipe(recipeName);
  const projectDir = await findProjectDir(ctx.cwd);

  if (!builtinRecipe) {
    const localRecipe = await resolveLocalRecipe(projectDir, recipeName);

    if (!localRecipe) {
      console.error(`Unknown recipe: ${recipeName}`);
      process.exitCode = 1;
      return;
    }

    const result = await installCapturedRecipe(projectDir, localRecipe);
    console.log(`Installed recipe ${localRecipe.manifest.name}`);

    if (result.configSkipped) {
      console.log(`Existing fde.config.ts was preserved; recipe config written to recipes/${localRecipe.manifest.name}/fde.config.ts`);
    } else if (result.configUpdated) {
      console.log(`Config updated: ${result.configPath}`);
    }

    return;
  }

  const result = await builtinRecipe.install(projectDir);
  console.log(`Installed recipe ${recipeName}`);

  if (result.configSkipped) {
    console.log(`Existing fde.config.ts was preserved; recipe config written to recipes/${recipeName}/fde.config.ts`);
  } else if (result.configUpdated) {
    console.log(`Config updated: ${result.configPath}`);
  }

  if (recipeName === 'support-triage') {
    console.log('Next: npm install && npm run demo');
  }
}
