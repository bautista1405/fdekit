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
import { renderCodebaseAgentConfig } from './templates/config.js';
import {
  isDefaultCodebasePrompt,
  isDefaultCodebaseEval,
  recipeReadme,
  workflowDoc,
  codebaseAgentPrompt,
  codebaseAgentEvals,
  codebaseAgentMockPlanner,
  codebaseAgentDemoRunner,
  sampleRepoReadme,
  sampleRepoPackage,
  sampleBillingSource,
  sampleSupportSource,
} from './helpers/index.js';

export const codebaseAgentRecipe: RecipeSpec = {
  name: 'codebase-agent',
  manifest: requireRecipeManifest('codebase-agent'),
  directories: [
    'agents',
    'evals',
    'scripts',
    'sample-repo/src',
  ],
  files: [
    { path: 'recipes/codebase-agent/README.md', contents: recipeReadme },
    { path: 'recipes/codebase-agent/workflow.md', contents: workflowDoc },
    { path: 'recipes/codebase-agent/mock-planner.mjs', contents: codebaseAgentMockPlanner },
    { path: 'scripts/demo.mjs', contents: codebaseAgentDemoRunner },
    { path: 'agents/codebase-agent.md', contents: codebaseAgentPrompt, overwriteDefault: isDefaultCodebasePrompt },
    { kind: 'json', path: 'evals/codebase-agent.json', value: codebaseAgentEvals, overwriteDefault: isDefaultCodebaseEval },
    { path: 'sample-repo/README.md', contents: sampleRepoReadme },
    { kind: 'json', path: 'sample-repo/package.json', value: sampleRepoPackage },
    { path: 'sample-repo/src/billing.ts', contents: sampleBillingSource },
    { path: 'sample-repo/src/support.ts', contents: sampleSupportSource },
  ],
  package: {
    fdekitScripts: {
      namespace: 'codebase',
      run: 'fdekit run codebaseAgent --input \'{"task":"Find TODO(fdekit) markers and create an engineering issue","query":"TODO(fdekit)"}\'',
    },
    scripts: {
      demo: 'node scripts/demo.mjs',
    },
    scriptsIfMissing: 'base',
    dependencies: fdekitDependencies([
      '@fdekit/connector-codebase',
      '@fdekit/connector-github',
      '@fdekit/connector-jira',
      '@fdekit/connector-linear',
      '@fdekit/core',
      '@fdekit/provider-anthropic',
      '@fdekit/provider-google',
      '@fdekit/provider-ollama',
      '@fdekit/provider-openai',
    ]),
    devDependencies: {
      '@fdekit/cli': fdekitDependencyVersion,
    },
  },
  env: [
    ...providerEnv(),
    env('CODEBASE_ROOT', './sample-repo', 'Repository to inspect; use .. when the FDEKit project lives in ./fdekit'),
    env('FDEKIT_ISSUE_TRACKER', 'github', 'Issue tracker backing issue.create; use github, jira, or linear'),
    env('FDEKIT_CONNECTOR_MODE', 'local', 'Set to api to create real external issues'),
    env('GITHUB_TOKEN', '', 'GitHub token for API mode issue creation'),
    env('GITHUB_REPOSITORY', 'owner/repo', 'GitHub repository for codebase findings'),
    env('JIRA_BASE_URL', 'https://your-domain.atlassian.net', 'Jira Cloud site URL for API mode'),
    env('JIRA_EMAIL', '', 'Jira account email for API token authentication'),
    env('JIRA_API_TOKEN', '', 'Jira API token for API mode issue creation'),
    env('JIRA_PROJECT_KEY', 'ENG', 'Jira project key for codebase findings'),
    env('LINEAR_API_KEY', '', 'Linear API key for API mode issue creation'),
    env('LINEAR_TEAM_ID', '', 'Linear team UUID for codebase findings'),
  ],
  gitignore: recipeGitignore,
  config: (ctx) => renderCodebaseAgentConfig(ctx),
};
