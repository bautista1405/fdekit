import { readRecipeAsset, readRecipeJsonAsset } from '../../assets.js';

const assetsUrl = import.meta.url;

export function loadTestAgentPrompt(): string {
  return readRecipeAsset(assetsUrl, '../files/agents/load-test-agent.md');
}

export function loadTestEvals() {
  return readRecipeJsonAsset(assetsUrl, '../files/evals/load-test-agent.json');
}

export function loadTestMockPlanner(): string {
  return readRecipeAsset(assetsUrl, '../files/recipes/load-test-agent/mock-planner.mjs');
}

export function loadTestDemoRunner(): string {
  return readRecipeAsset(assetsUrl, '../files/scripts/demo.mjs');
}

export function k6Script(): string {
  return readRecipeAsset(assetsUrl, '../files/load-tests/customer-api-smoke.js');
}

export function customerApiServer(): string {
  return readRecipeAsset(assetsUrl, '../files/customer-api/server.js');
}
