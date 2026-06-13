import { readRecipeAsset } from '../../assets.js';

const assetsUrl = import.meta.url;

export function recipeReadme(): string {
  return readRecipeAsset(assetsUrl, '../files/recipes/sales-research-agent/README.md');
}

export function workflowDoc(): string {
  return readRecipeAsset(assetsUrl, '../files/recipes/sales-research-agent/workflow.md');
}
