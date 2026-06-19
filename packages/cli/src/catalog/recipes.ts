import type { RecipeManifest } from './types.js';

export const recipeManifests: RecipeManifest[] = [
  {
    kind: 'recipe',
    id: 'support-triage',
    displayName: 'Support Triage',
    whatItProves: 'Customer API lookup, support escalation, Slack notification, issue creation, approval evidence, report',
    localByDefault: 'Local API, local Slack-style message, local GitHub-style issue',
    livePath: 'Slack API and GitHub API',
  },
  {
    kind: 'recipe',
    id: 'codebase-agent',
    displayName: 'Codebase Agent',
    whatItProves: 'Search/read a customer repo, create an engineering issue, run codebase evals',
    localByDefault: 'Local sample repo and local issue creation',
    livePath: 'GitHub, Jira, or Linear',
  },
  {
    kind: 'recipe',
    id: 'sales-research-agent',
    displayName: 'Sales Research Agent',
    whatItProves: 'Research an account, gather buyer context, create a CRM note',
    localByDefault: 'Local CRM/research dataset and local CRM note',
    livePath: 'HubSpot or Salesforce',
  },
  {
    kind: 'recipe',
    id: 'load-test-agent',
    displayName: 'Load Test Agent',
    whatItProves: 'Exercise the governed workflow locally or capture measured k6 threshold evidence',
    localByDefault: 'Deterministic no-HTTP simulation',
    livePath: 'Measured local k6 CLI run against a customer API',
  },
];

export function requireRecipeManifest(name: string): RecipeManifest {
  const manifest = recipeManifests.find((candidate) => candidate.id === name);

  if (!manifest) {
    throw new Error(`Unknown built-in recipe manifest: ${name}`);
  }

  return manifest;
}
