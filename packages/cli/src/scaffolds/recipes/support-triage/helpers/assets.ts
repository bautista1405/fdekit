import { readRecipeAsset, readRecipeJsonAsset } from '../../assets.js';

const assetsUrl = import.meta.url;

export function supportTriagePrompt(): string {
  return readRecipeAsset(assetsUrl, '../files/agents/support-triage.md');
}

export function supportTriageEvals() {
  return readRecipeJsonAsset(assetsUrl, '../files/evals/support-triage.json');
}

export function supportTriageMockPlanner(): string {
  return readRecipeAsset(assetsUrl, '../files/recipes/support-triage/mock-planner.mjs');
}

export function customerApiSeed() {
  return readRecipeJsonAsset(assetsUrl, '../files/customer-api/data/seed.json');
}

export function customerApiServer(): string {
  return readRecipeAsset(assetsUrl, '../files/customer-api/server.js');
}

export function supportTriageDemoRunner(): string {
  return readRecipeAsset(assetsUrl, '../files/scripts/demo.mjs');
}
