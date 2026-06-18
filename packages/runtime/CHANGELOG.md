# @fdekit/runtime

## 0.4.2

### Patch Changes

- dbe7868: Simplify newly initialized projects around an env-selected provider, a minimal runnable agent config, clearer `.env.example` guidance, and a first-loop npm script. Config discovery and all file-creating workflows now keep deployment files, package/env mutations, recipes, and runtime output inside a contained `fdekit/` project, while preserving legacy root configs and invocation-relative recipe paths. The default runtime output and cache directory is now `artifacts/` instead of `.fdekit/`.
- c77f318: fdekit init scaffolding, simpler starter config
- Updated dependencies [dbe7868]
- Updated dependencies [c77f318]
  - @fdekit/core@0.4.2

## 0.4.1

### Patch Changes

- 558a126: patches for connectors, providers and environments: error handling, idempotency for tools and connectors, environments examples, tool error handling for providers
- Updated dependencies [558a126]
  - @fdekit/core@0.4.1

## 0.4.0

### Minor Changes

- 1e4afcc: command line fixes, improvements

### Patch Changes

- @fdekit/core@0.4.0

## 0.3.0

### Minor Changes

- 0cb6f4a: Add environment endpoint references: `environmentEndpoint('customer-api')` lets connectors resolve their base URL from the runtime environment's exported endpoints at tool-call time (via the new `ToolCallContext.runtimeEnvironment`), making the environment the single source of truth for customer API wiring. `fdekit validate` errors when a referenced endpoint is not exported. The support-triage scaffold drops its manual `CUSTOMER_API_URL` wiring and relies on the connector's call-time env resolution.
- 0cb6f4a: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.

### Patch Changes

- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
  - @fdekit/core@0.3.0

## 0.2.0

### Minor Changes

- 16dc2da: Add environment endpoint references: `environmentEndpoint('customer-api')` lets connectors resolve their base URL from the runtime environment's exported endpoints at tool-call time (via the new `ToolCallContext.runtimeEnvironment`), making the environment the single source of truth for customer API wiring. `fdekit validate` errors when a referenced endpoint is not exported. The support-triage scaffold drops its manual `CUSTOMER_API_URL` wiring and relies on the connector's call-time env resolution.
- 16dc2da: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.

### Patch Changes

- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
  - @fdekit/core@0.2.0
