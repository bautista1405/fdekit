import { readRecipeAsset, readRecipeJsonAsset } from '../../assets.js';

const assetsUrl = import.meta.url;

export function codebaseAgentPrompt(): string {
  return readRecipeAsset(assetsUrl, '../files/agents/codebase-agent.md');
}

export function codebaseAgentEvals() {
  return readRecipeJsonAsset(assetsUrl, '../files/evals/codebase-agent.json');
}

export function codebaseAgentMockPlanner(): string {
  return readRecipeAsset(assetsUrl, '../files/recipes/codebase-agent/mock-planner.mjs');
}

export function codebaseAgentDemoRunner(): string {
  return readRecipeAsset(assetsUrl, '../files/scripts/demo.mjs');
}

export function sampleRepoReadme(): string {
  return readRecipeAsset(assetsUrl, '../files/sample-repo/README.md');
}

export function sampleRepoPackage() {
  return readRecipeJsonAsset(assetsUrl, '../files/sample-repo/package.json');
}

export function sampleBillingSource(): string {
  return readRecipeAsset(assetsUrl, '../files/sample-repo/src/billing.ts');
}

export function sampleSupportSource(): string {
  return readRecipeAsset(assetsUrl, '../files/sample-repo/src/support.ts');
}
