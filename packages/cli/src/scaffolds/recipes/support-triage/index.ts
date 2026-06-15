import { requireRecipeManifest } from '../../../catalog/recipes.js';
import {
  fdekitDependencies,
  fdekitDependencyVersion,
} from '../../../package-versions.js';
import { recipeGitignore, type RecipeSpec } from '../spec.js';
import { renderSupportTriageConfig } from './templates/config.js';
import {
  isDefaultSupportTriagePrompt,
  isDefaultSupportTriageEval,
  recipeReadme,
  workflowDoc,
  supportTriagePrompt,
  supportTriageEvals,
  supportTriageMockPlanner,
  supportTriageDemoRunner,
  customerApiSeed,
  customerApiServer,
} from './helpers/index.js';

export const supportTriageRecipe: RecipeSpec = {
  name: 'support-triage',
  manifest: requireRecipeManifest('support-triage'),
  directories: [
    'agents',
    'evals',
    'customer-api/data',
    'scripts',
  ],
  files: [
    { path: 'recipes/support-triage/README.md', contents: recipeReadme },
    { path: 'recipes/support-triage/workflow.md', contents: workflowDoc },
    { path: 'recipes/support-triage/mock-planner.mjs', contents: supportTriageMockPlanner },
    { path: 'scripts/demo.mjs', contents: supportTriageDemoRunner },
    { path: 'agents/support-triage.md', contents: supportTriagePrompt, overwriteDefault: isDefaultSupportTriagePrompt },
    { kind: 'json', path: 'evals/support-triage.json', value: supportTriageEvals, overwriteDefault: isDefaultSupportTriageEval },
    { path: 'customer-api/server.js', contents: customerApiServer },
    { kind: 'json', path: 'customer-api/data/seed.json', value: customerApiSeed },
  ],
  package: {
    serviceScripts: {
      api: 'node customer-api/server.js',
    },
    scripts: {
      demo: 'node scripts/demo.mjs',
    },
    fdekitScripts: {
      run: 'fdekit run supportTriage --ticket tick_1001',
    },
    dependencies: fdekitDependencies([
      '@fdekit/connector-customer-api',
      '@fdekit/connector-github',
      '@fdekit/connector-slack',
      '@fdekit/core',
    ]),
    devDependencies: {
      '@fdekit/cli': fdekitDependencyVersion,
    },
  },
  gitignore: recipeGitignore,
  config: (ctx) => renderSupportTriageConfig(ctx),
};
