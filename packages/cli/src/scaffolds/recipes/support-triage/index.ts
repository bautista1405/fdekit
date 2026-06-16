import {
  env,
  providerEnv,
} from '../../registry.js';
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
    type: 'module',
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
  env: [
    ...providerEnv(),
    env('FDEKIT_CONNECTOR_MODE', 'local', 'Set to api to create real GitHub issues and Slack messages'),
    env('CUSTOMER_API_URL', 'http://127.0.0.1:8787', 'Customer API base URL for support tickets and account context'),
    env('GITHUB_TOKEN', '', 'GitHub token for API mode issue creation'),
    env('GITHUB_REPOSITORY', 'owner/repo', 'GitHub repository for support escalation issues'),
    env('SLACK_BOT_TOKEN', '', 'Slack bot token for API mode escalation messages'),
    env('SLACK_CHANNEL_ID', '#support-escalations', 'Slack channel used by support escalation messages'),
  ],
  gitignore: recipeGitignore,
  config: (ctx) => renderSupportTriageConfig(ctx),
};
