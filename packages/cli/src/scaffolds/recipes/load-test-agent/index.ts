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
import { renderLoadTestConfig } from './templates/config.js';
import {
  isDefaultLoadTestPrompt,
  isDefaultLoadTestEval,
  loadTestAgentPrompt,
  loadTestEvals,
  loadTestMockPlanner,
  loadTestDemoRunner,
  recipeReadme,
  workflowDoc,
  k6Script,
  customerApiServer,
} from './helpers/index.js';

export const loadTestRecipe: RecipeSpec = {
  name: 'load-test-agent',
  manifest: requireRecipeManifest('load-test-agent'),
  directories: [
    'agents',
    'evals',
    'scripts',
    'load-tests/.results',
    'customer-api',
  ],
  files: [
    { path: 'recipes/load-test-agent/README.md', contents: recipeReadme },
    { path: 'recipes/load-test-agent/workflow.md', contents: workflowDoc },
    { path: 'recipes/load-test-agent/mock-planner.mjs', contents: loadTestMockPlanner },
    { path: 'scripts/demo.mjs', contents: loadTestDemoRunner },
    { path: 'agents/load-test-agent.md', contents: loadTestAgentPrompt, overwriteDefault: isDefaultLoadTestPrompt },
    { kind: 'json', path: 'evals/load-test-agent.json', value: loadTestEvals, overwriteDefault: isDefaultLoadTestEval },
    { path: 'load-tests/customer-api-smoke.js', contents: k6Script },
    { path: 'customer-api/server.js', contents: customerApiServer },
  ],
  package: {
    type: 'module',
    serviceScripts: {
      'loadtest:api': 'node customer-api/server.js',
    },
    fdekitScripts: {
      namespace: 'loadtest',
      run: 'fdekit run loadTestAgent --input \'{"scenario":"smoke","targetUrl":"http://localhost:8000","vus":5,"duration":"10s"}\'',
    },
    scripts: {
      demo: 'node scripts/demo.mjs',
    },
    scriptsIfMissing: 'base',
    dependencies: fdekitDependencies([
      '@fdekit/connector-k6',
      '@fdekit/core',
    ]),
    devDependencies: {
      '@fdekit/cli': fdekitDependencyVersion,
    },
  },
  env: [
    ...providerEnv(),
    env('FDEKIT_LOAD_TEST_MODE', 'local', 'Use local for deterministic runs or k6 to invoke the local k6 binary'),
    env('LOAD_TEST_TARGET_URL', 'http://localhost:8000', 'Customer API base URL for load testing'),
    env('K6_BINARY', 'k6', 'k6 command or binary path used when FDEKIT_LOAD_TEST_MODE=k6'),
    env('K6_SCRIPT', './load-tests/customer-api-smoke.js', 'k6 JavaScript test file'),
    env('K6_DEFAULT_VUS', '5', 'Default virtual users for the load-test tool'),
    env('K6_DEFAULT_DURATION', '10s', 'Default load-test duration'),
    env('K6_MAX_VUS', '50', 'Safety cap for virtual users requested by the agent'),
    env('K6_MAX_DURATION_SECONDS', '300', 'Safety cap for load-test duration requested by the agent'),
    env('K6_P95_THRESHOLD_MS', '500', 'p95 latency threshold used in FDEKit results'),
    env('K6_ERROR_RATE_THRESHOLD', '0.01', 'Allowed request error rate used in FDEKit results'),
  ],
  gitignore: `${recipeGitignore}load-tests/.results\n`,
  config: (ctx) => renderLoadTestConfig(ctx),
};
