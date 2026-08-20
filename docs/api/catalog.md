# @fdekit/catalog API Reference

<!-- Maintained via scripts/generate-api-docs.mjs. -->
Run `npm run docs:api` to refresh this page after changing public exports.

Applies to `@fdekit/catalog` v0.5.3.

Declaration source: `packages/catalog/dist/index.d.ts`.

## Stability And Audience

| Stability | Intended audience |
| --- | --- |
| Public, pre-1.0 package-root API | CLI maintainers, documentation tooling, deployment surfaces, and contributors editing built-in manifests. |

- Import from `@fdekit/catalog`; the package contains metadata and scaffold descriptions, not executable provider or connector implementations.
- Canonical names and aliases are resolved through lookup helpers so consumers do not duplicate catalog matching rules.

## Top Symbols

| Symbol | Why advanced users reach for it |
| --- | --- |
| [`providerManifests`](#providermanifests) | All built-in provider metadata in stable catalog order. |
| [`connectorManifests`](#connectormanifests) | All built-in connector metadata in stable catalog order. |
| [`recipeManifests`](#recipemanifests) | All built-in recipe metadata in stable catalog order. |
| [`providerManifest`](#providermanifest) | Resolve a provider by canonical name or supported alias. |
| [`connectorManifest`](#connectormanifest) | Resolve a connector by canonical name or supported alias. |
| [`recipeManifest`](#recipemanifest) | Resolve a recipe by canonical name. |
| [`providerScaffold`](#providerscaffold) | Resolve provider scaffolding for a canonical name or alias. |
| [`connectorScaffold`](#connectorscaffold) | Resolve connector scaffolding for a canonical name or alias. |
| [`ProviderManifest`](#providermanifest) | Typed provider catalog entry. |
| [`ConnectorManifest`](#connectormanifest) | Typed connector catalog entry. |
| [`RecipeManifest`](#recipemanifest) | Typed recipe catalog entry. |

## Export Count

This page documents 26 public root exports from `@fdekit/catalog`: 18 functions/values and 8 types/interfaces.

## Functions And Values

| Symbol | Kind | Defined in |
| --- | --- | --- |
| <a id="connectormanifest"></a>`connectorManifest` | function | [packages/catalog/src/index.ts](../../packages/catalog/src/index.ts) |
| <a id="connectormanifests"></a>`connectorManifests` | const | [packages/catalog/src/connectors.ts](../../packages/catalog/src/connectors.ts) |
| <a id="connectornames"></a>`connectorNames` | function | [packages/catalog/src/index.ts](../../packages/catalog/src/index.ts) |
| <a id="connectorscaffold"></a>`connectorScaffold` | function | [packages/catalog/src/index.ts](../../packages/catalog/src/index.ts) |
| <a id="connectorscaffoldnames"></a>`connectorScaffoldNames` | function | [packages/catalog/src/index.ts](../../packages/catalog/src/index.ts) |
| <a id="fdekitcaretdependencyversion"></a>`fdekitCaretDependencyVersion` | const | [packages/catalog/src/package-versions.ts](../../packages/catalog/src/package-versions.ts) |
| <a id="fdekitdependencies"></a>`fdekitDependencies` | function | [packages/catalog/src/package-versions.ts](../../packages/catalog/src/package-versions.ts) |
| <a id="fdekitdependency"></a>`fdekitDependency` | function | [packages/catalog/src/package-versions.ts](../../packages/catalog/src/package-versions.ts) |
| <a id="fdekitdependencyversion"></a>`fdekitDependencyVersion` | const | [packages/catalog/src/package-versions.ts](../../packages/catalog/src/package-versions.ts) |
| <a id="providermanifest"></a>`providerManifest` | function | [packages/catalog/src/index.ts](../../packages/catalog/src/index.ts) |
| <a id="providermanifests"></a>`providerManifests` | const | [packages/catalog/src/providers.ts](../../packages/catalog/src/providers.ts) |
| <a id="providernames"></a>`providerNames` | function | [packages/catalog/src/index.ts](../../packages/catalog/src/index.ts) |
| <a id="providerscaffold"></a>`providerScaffold` | function | [packages/catalog/src/index.ts](../../packages/catalog/src/index.ts) |
| <a id="providerscaffoldnames"></a>`providerScaffoldNames` | function | [packages/catalog/src/index.ts](../../packages/catalog/src/index.ts) |
| <a id="recipemanifest"></a>`recipeManifest` | function | [packages/catalog/src/index.ts](../../packages/catalog/src/index.ts) |
| <a id="recipemanifests"></a>`recipeManifests` | const | [packages/catalog/src/recipes.ts](../../packages/catalog/src/recipes.ts) |
| <a id="recipenames"></a>`recipeNames` | function | [packages/catalog/src/index.ts](../../packages/catalog/src/index.ts) |
| <a id="requirerecipemanifest"></a>`requireRecipeManifest` | function | [packages/catalog/src/recipes.ts](../../packages/catalog/src/recipes.ts) |

## Types And Interfaces

| Symbol | Kind | Defined in |
| --- | --- | --- |
| <a id="addscaffold"></a>`AddScaffold` | interface | [packages/catalog/src/types.ts](../../packages/catalog/src/types.ts) |
| <a id="catalogenvvar"></a>`CatalogEnvVar` | interface | [packages/catalog/src/types.ts](../../packages/catalog/src/types.ts) |
| <a id="catalogimportspec"></a>`CatalogImportSpec` | interface | [packages/catalog/src/types.ts](../../packages/catalog/src/types.ts) |
| <a id="catalogmaturity"></a>`CatalogMaturity` | type | [packages/catalog/src/types.ts](../../packages/catalog/src/types.ts) |
| <a id="catalogscaffoldalias"></a>`CatalogScaffoldAlias` | interface | [packages/catalog/src/types.ts](../../packages/catalog/src/types.ts) |
| <a id="connectormanifest"></a>`ConnectorManifest` | interface | [packages/catalog/src/types.ts](../../packages/catalog/src/types.ts) |
| <a id="providermanifest"></a>`ProviderManifest` | interface | [packages/catalog/src/types.ts](../../packages/catalog/src/types.ts) |
| <a id="recipemanifest"></a>`RecipeManifest` | interface | [packages/catalog/src/types.ts](../../packages/catalog/src/types.ts) |
