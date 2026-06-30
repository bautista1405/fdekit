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
import { renderSalesResearchConfig } from './templates/config.js';
import {
  isDefaultSalesResearchPrompt,
  isDefaultSalesResearchEval,
  recipeReadme,
  workflowDoc,
  salesResearchPrompt,
  salesResearchEvals,
  salesResearchMockPlanner,
  salesResearchDemoRunner,
  salesResearchSeed,
} from './helpers/index.js';

export const salesResearchRecipe: RecipeSpec = {
  name: 'sales-research-agent',
  manifest: requireRecipeManifest('sales-research-agent'),
  directories: [
    'agents',
    'evals',
    'scripts',
    'sales-data',
  ],
  files: [
    { path: 'recipes/sales-research-agent/README.md', contents: recipeReadme },
    { path: 'recipes/sales-research-agent/workflow.md', contents: workflowDoc },
    { path: 'recipes/sales-research-agent/mock-planner.mjs', contents: salesResearchMockPlanner },
    { path: 'scripts/demo.mjs', contents: salesResearchDemoRunner },
    { path: 'agents/sales-research-agent.md', contents: salesResearchPrompt, overwriteDefault: isDefaultSalesResearchPrompt },
    { kind: 'json', path: 'evals/sales-research-agent.json', value: salesResearchEvals, overwriteDefault: isDefaultSalesResearchEval },
    { kind: 'json', path: 'sales-data/prospects.json', value: salesResearchSeed },
  ],
  package: {
    fdekitScripts: {
      namespace: 'sales',
      run: 'fdekit run salesResearchAgent --input \'{"accountId":"acct_company","persona":"CRO"}\'',
      evalTarget: 'salesResearchAgent',
    },
    scripts: {
      demo: 'node scripts/demo.mjs',
    },
    scriptsIfMissing: 'base',
    dependencies: fdekitDependencies([
      '@fdekit/core',
      '@fdekit/connector-hubspot',
      '@fdekit/connector-salesforce',
      '@fdekit/provider-google',
    ]),
    devDependencies: {
      '@fdekit/cli': fdekitDependencyVersion,
    },
  },
  env: [
    ...providerEnv(),
    env('FDEKIT_CRM', 'local', 'CRM backend for crm.note.create; use local, hubspot, or salesforce'),
    env('FDEKIT_CONNECTOR_MODE', 'local', 'Set to api to turn the selected CRM connector into live API mode'),
    env('SALES_RESEARCH_DATASET', './sales-data/prospects.json', 'Local sales research dataset; replace with a customer CRM export for the first demo rung'),
    env('HUBSPOT_ACCESS_TOKEN', '', 'HubSpot private app token used when FDEKIT_CRM=hubspot and FDEKIT_CONNECTOR_MODE=api'),
    env('HUBSPOT_PORTAL_ID', '', 'Optional HubSpot portal id used to build note links'),
    env('SALESFORCE_INSTANCE_URL', 'https://your-domain.my.salesforce.com', 'Salesforce instance URL used when FDEKIT_CRM=salesforce and FDEKIT_CONNECTOR_MODE=api'),
    env('SALESFORCE_ACCESS_TOKEN', '', 'Salesforce OAuth access token used when FDEKIT_CRM=salesforce and FDEKIT_CONNECTOR_MODE=api'),
    env('SALESFORCE_API_VERSION', 'v60.0', 'Optional Salesforce REST API version override'),
    env('SALESFORCE_ACCOUNT_ID', '', 'Optional default Salesforce Account/Opportunity id for CRM notes'),
  ],
  gitignore: recipeGitignore,
  config: (ctx) => renderSalesResearchConfig(ctx),
};
