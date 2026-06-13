import { codebaseAgentRecipe } from './codebase-agent/index.js';
import { loadTestRecipe } from './load-test-agent/index.js';
import { salesResearchRecipe } from './sales-research-agent/index.js';
import { supportTriageRecipe } from './support-triage/index.js';
import type { BuiltinRecipe } from '../registry.js';
import { installRecipeSpec, type RecipeSpec } from './spec.js';

export const builtinRecipeSpecs: RecipeSpec[] = [
  supportTriageRecipe,
  codebaseAgentRecipe,
  salesResearchRecipe,
  loadTestRecipe,
];

export const builtinRecipeManifests = builtinRecipeSpecs.map((recipe) => recipe.manifest);

export const builtinRecipes: BuiltinRecipe[] = builtinRecipeSpecs.map((recipe) => ({
  name: recipe.name,
  install: (projectDir) => installRecipeSpec(projectDir, recipe),
}));
