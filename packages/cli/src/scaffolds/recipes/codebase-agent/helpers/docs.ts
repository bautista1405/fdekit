import { readRecipeAsset } from '../../assets.js';

const assetsUrl = import.meta.url;

export function recipeReadme(): string {
  return readRecipeAsset(assetsUrl, '../files/recipes/codebase-agent/README.md');
}

export function workflowDoc(): string {
  return readRecipeAsset(assetsUrl, '../files/recipes/codebase-agent/workflow.md');
}
