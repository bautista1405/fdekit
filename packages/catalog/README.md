# @fdekit/catalog

`@fdekit/catalog` is the shared source of truth for FDEKit provider, connector, and recipe metadata. The CLI uses it for scaffolding and help; documentation generators and deployment surfaces can consume the same typed manifests without importing CLI internals.

```ts
import {
  connectorManifest,
  connectorNames,
  providerManifest,
  recipeManifests,
} from '@fdekit/catalog';

const github = connectorManifest('github');
const availableConnectors = connectorNames();
const openai = providerManifest('openai');
```

Canonical names and supported aliases resolve through `providerManifest()` and `connectorManifest()`. Use `providerScaffold()` or `connectorScaffold()` when generating configuration and dependency entries. Unknown lookups return `undefined`; `requireRecipeManifest()` throws for an unknown recipe.

The package is metadata, not a plugin loader or remote marketplace. Importing it does not load provider SDKs, connector credentials, or executable customer modules.

FDEKit packages are released as one fixed version group. Dependency helpers read this package's own version, with `FDEKIT_SCAFFOLD_VERSION` available for repository example synchronization and tests.
