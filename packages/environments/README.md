# Environment Package Layout

Environment packages describe the customer-like runtime around an FDEKit deployment. They should stay thin adapters over `@fdekit/core` environment contracts, not mini runtimes.

Each package follows the same source layout:

| Folder | Owns |
| --- | --- |
| `config` | Static defaults such as compose command names, Floci images, ports, and endpoint names. |
| `types` | Small string unions and package-specific primitive type aliases. |
| `interfaces` | Public option/config/definition contracts, split by command, customer API, and environment shape. |
| `helpers` | Pure normalization and command-string helpers. No `defineEnvironment()` calls here. |
| `primitives` | Public factory orchestration plus focused builders for commands, evidence, and cloud env values. |

Keep package-root exports stable through `src/index.ts`. Split internals by domain, but do not require users to import subpaths.

When adding a new environment package:

1. Start with `interfaces/environment.ts` and keep the public option shape small.
2. Put shell or command-string rendering in `helpers/commands.ts`.
3. Put env var merging and service normalization in helpers, not the public factory.
4. Keep `primitives/index.ts` readable top-down: resolve defaults, build config, build commands/evidence, return `defineEnvironment()`.
5. Add package-local tests for generated commands, env vars, health checks, and evidence shape.
