import { readRecipeAsset, readRecipeJsonAsset } from '../../assets.js';

const assetsUrl = import.meta.url;

export function salesResearchPrompt(): string {
  return readRecipeAsset(assetsUrl, '../files/agents/sales-research-agent.md');
}

export function salesResearchEvals() {
  return readRecipeJsonAsset(assetsUrl, '../files/evals/sales-research-agent.json');
}

export function salesResearchMockPlanner(): string {
  return readRecipeAsset(assetsUrl, '../files/recipes/sales-research-agent/mock-planner.mjs');
}

export function salesResearchDemoRunner(): string {
  return readRecipeAsset(assetsUrl, '../files/scripts/demo.mjs');
}

export function salesResearchSeed() {
  return readRecipeJsonAsset(assetsUrl, '../files/sales-data/prospects.json');
}
