import { connectorManifests } from './connectors.js';
import { providerManifests } from './providers.js';
import { recipeManifests } from './recipes.js';
import type {
  AddScaffold,
  CatalogScaffoldAlias,
  ConnectorManifest,
  ProviderManifest,
  RecipeManifest,
} from './types.js';

export type {
  AddScaffold,
  CatalogEnvVar,
  CatalogImportSpec,
  CatalogMaturity,
  ConnectorManifest,
  ProviderManifest,
  RecipeManifest,
} from './types.js';
export { connectorManifests, providerManifests };
export { recipeManifests };

export function providerManifest(name: string): ProviderManifest | undefined {
  return providerManifests.find((manifest) => matchesManifestName(manifest, name));
}

export function connectorManifest(name: string): ConnectorManifest | undefined {
  return connectorManifests.find((manifest) => matchesManifestName(manifest, name));
}

export function recipeManifest(name: string): RecipeManifest | undefined {
  return recipeManifests.find((manifest) => manifest.id === name);
}

export function providerScaffold(name: string): AddScaffold | undefined {
  return scaffoldFor(providerManifest(name), name);
}

export function connectorScaffold(name: string): AddScaffold | undefined {
  return scaffoldFor(connectorManifest(name), name);
}

export function providerNames(): string[] {
  return providerManifests.map((manifest) => manifest.id);
}

export function connectorNames(): string[] {
  return connectorManifests.map((manifest) => manifest.id);
}

export function recipeNames(): string[] {
  return recipeManifests.map((manifest) => manifest.id);
}

export function providerScaffoldNames(): string[] {
  return providerManifests.flatMap((manifest) => [
    manifest.id,
    ...(manifest.aliases ?? []).map((alias) => alias.name),
  ]);
}

export function connectorScaffoldNames(): string[] {
  return connectorManifests.flatMap((manifest) => [
    manifest.id,
    ...(manifest.aliases ?? []).map((alias) => alias.name),
  ]);
}

function matchesManifestName(
  manifest: { id: string; aliases?: CatalogScaffoldAlias[] },
  name: string,
): boolean {
  return manifest.id === name || Boolean(manifest.aliases?.some((alias) => alias.name === name));
}

function scaffoldFor(
  manifest: { scaffold?: AddScaffold; aliases?: CatalogScaffoldAlias[] } | undefined,
  name: string,
): AddScaffold | undefined {
  if (!manifest) {
    return undefined;
  }

  return manifest.aliases?.find((alias) => alias.name === name)?.scaffold ?? manifest.scaffold;
}
