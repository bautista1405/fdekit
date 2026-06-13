import { builtinRecipeManifests, builtinRecipes } from './recipes/index.js';
import type { BuiltinRecipe } from './registry.js';

export type { RecipeInstallResult } from './registry.js';
export { builtinRecipeManifests, builtinRecipes };

export function findBuiltinRecipe(name: string): BuiltinRecipe | undefined {
  return builtinRecipes.find((recipe) => recipe.name === name);
}
