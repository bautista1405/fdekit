import { describe, expect, it } from 'vitest';
import {
  connectorManifest,
  connectorManifests,
  connectorNames,
  connectorScaffold,
  connectorScaffoldNames,
  fdekitDependencyVersion,
  providerManifest,
  providerManifests,
  providerNames,
  providerScaffold,
  providerScaffoldNames,
  recipeManifest,
  recipeManifests,
  recipeNames,
  requireRecipeManifest,
  type AddScaffold,
  type CatalogScaffoldAlias,
} from '../index.js';

describe('provider catalog', () => {
  it('resolves every canonical provider and exported name', () => {
    expect(providerNames()).toEqual(providerManifests.map((manifest) => manifest.id));
    expect(new Set(providerNames()).size).toBe(providerManifests.length);

    for (const manifest of providerManifests) {
      expect(manifest.kind).toBe('provider');
      expect(providerManifest(manifest.id)).toBe(manifest);
      expect(providerScaffold(manifest.id)).toBe(manifest.scaffold);
    }
  });

  it('resolves aliases to their owning provider and alias-specific scaffold', () => {
    assertAliases({
      manifests: providerManifests,
      resolveManifest: providerManifest,
      resolveScaffold: providerScaffold,
      scaffoldNames: providerScaffoldNames(),
    });

    expect(providerManifest('ollama')?.id).toBe('localOllama');
    expect(providerScaffold('ollama')?.key).toBe('ollama');
    expect(providerManifest('gemini')?.id).toBe('google');
  });

  it('returns undefined for unknown provider names', () => {
    expect(providerManifest('not-a-provider')).toBeUndefined();
    expect(providerScaffold('not-a-provider')).toBeUndefined();
  });
});

describe('connector catalog', () => {
  it('resolves every canonical connector and exported name', () => {
    expect(connectorNames()).toEqual(connectorManifests.map((manifest) => manifest.id));
    expect(new Set(connectorNames()).size).toBe(connectorManifests.length);

    for (const manifest of connectorManifests) {
      expect(manifest.kind).toBe('connector');
      expect(connectorManifest(manifest.id)).toBe(manifest);
      expect(connectorScaffold(manifest.id)).toBe(manifest.scaffold);
      expect(new Set(manifest.tools).size).toBe(manifest.tools.length);
    }
  });

  it('keeps scaffold names unique and resolves any connector aliases', () => {
    assertAliases({
      manifests: connectorManifests,
      resolveManifest: connectorManifest,
      resolveScaffold: connectorScaffold,
      scaffoldNames: connectorScaffoldNames(),
    });
  });

  it('returns undefined for unknown connector names', () => {
    expect(connectorManifest('not-a-connector')).toBeUndefined();
    expect(connectorScaffold('not-a-connector')).toBeUndefined();
  });
});

describe('recipe catalog', () => {
  it('resolves every recipe through optional and required lookup APIs', () => {
    expect(recipeNames()).toEqual(recipeManifests.map((manifest) => manifest.id));
    expect(new Set(recipeNames()).size).toBe(recipeManifests.length);

    for (const manifest of recipeManifests) {
      expect(manifest.kind).toBe('recipe');
      expect(recipeManifest(manifest.id)).toBe(manifest);
      expect(requireRecipeManifest(manifest.id)).toBe(manifest);
    }
  });

  it('distinguishes optional lookup from required lookup for unknown recipes', () => {
    expect(recipeManifest('not-a-recipe')).toBeUndefined();
    expect(() => requireRecipeManifest('not-a-recipe')).toThrow(
      'Unknown built-in recipe manifest: not-a-recipe',
    );
  });
});

describe('catalog invariants', () => {
  it('keeps provider and connector lookup names unambiguous', () => {
    expectUniqueLookupNames(providerManifests);
    expectUniqueLookupNames(connectorManifests);
  });

  it('keeps scaffold dependency entries internally consistent', () => {
    const scaffolds = [...providerManifests, ...connectorManifests].flatMap((manifest) => [
      manifest.scaffold,
      ...(manifest.aliases ?? []).map((alias) => alias.scaffold),
    ]);

    for (const scaffold of scaffolds) {
      if (!scaffold) continue;

      expect(scaffold.key).not.toBe('');
      expect(scaffold.expression).not.toBe('');
      expectUnique(scaffold.imports?.map((entry) => entry.moduleName) ?? []);
      expectUnique(scaffold.env?.map((entry) => entry.name) ?? []);

      for (const [packageName, version] of Object.entries(scaffold.dependencies ?? {})) {
        expect(packageName).not.toBe('');
        expect(version).not.toBe('');

        if (packageName.startsWith('@fdekit/')) {
          expect(version).toBe(fdekitDependencyVersion);
        }
      }
    }
  });
});

interface AliasManifest {
  id: string;
  scaffold?: AddScaffold;
  aliases?: CatalogScaffoldAlias[];
}

function assertAliases<T extends AliasManifest>({
  manifests,
  resolveManifest,
  resolveScaffold,
  scaffoldNames,
}: {
  manifests: T[];
  resolveManifest: (name: string) => T | undefined;
  resolveScaffold: (name: string) => AddScaffold | undefined;
  scaffoldNames: string[];
}) {
  const expectedNames = manifests.flatMap((manifest) => [
    ...(manifest.scaffold ? [manifest.id] : []),
    ...(manifest.aliases ?? []).map((alias) => alias.name),
  ]);

  expect(scaffoldNames).toEqual(expectedNames);
  expectUnique(scaffoldNames);

  for (const manifest of manifests) {
    for (const alias of manifest.aliases ?? []) {
      expect(resolveManifest(alias.name)).toBe(manifest);
      expect(resolveScaffold(alias.name)).toBe(alias.scaffold);
    }
  }
}

function expectUniqueLookupNames(manifests: AliasManifest[]) {
  const names = manifests.flatMap((manifest) => [
    manifest.id,
    ...(manifest.aliases ?? []).map((alias) => alias.name),
  ]);

  expectUnique(names);
}

function expectUnique(values: string[]) {
  expect(new Set(values).size).toBe(values.length);
}
