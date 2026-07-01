# fdekit

## 0.4.7

### Patch Changes

- ad31181: console report modifications, command and runtime-related small changes
- Updated dependencies [ad31181]
  - @fdekit/console@0.4.7
  - @fdekit/core@0.4.7
  - @fdekit/provider-anthropic@0.4.7
  - @fdekit/provider-google@0.4.7
  - @fdekit/provider-ollama@0.4.7
  - @fdekit/provider-openai@0.4.7
  - @fdekit/runtime@0.4.7

## 0.4.6

### Patch Changes

- Updated dependencies [e523d60]
  - @fdekit/console@0.4.6
  - @fdekit/core@0.4.6
  - @fdekit/runtime@0.4.6
  - @fdekit/provider-anthropic@0.4.6
  - @fdekit/provider-google@0.4.6
  - @fdekit/provider-ollama@0.4.6
  - @fdekit/provider-openai@0.4.6

## 0.4.5

### Patch Changes

- f1919a1: take connectors variables from .env, search by substring on codebase.search, use the correct labels for jira and linear
- Updated dependencies [f1919a1]
  - @fdekit/console@0.4.5
  - @fdekit/core@0.4.5
  - @fdekit/provider-anthropic@0.4.5
  - @fdekit/provider-google@0.4.5
  - @fdekit/provider-ollama@0.4.5
  - @fdekit/provider-openai@0.4.5
  - @fdekit/runtime@0.4.5

## 0.4.4

### Patch Changes

- d1d9280: validate connectors, polish commands, runs and evidence with k6, s3 client validation
- Updated dependencies [d1d9280]
  - @fdekit/console@0.4.4
  - @fdekit/core@0.4.4
  - @fdekit/provider-anthropic@0.4.4
  - @fdekit/provider-google@0.4.4
  - @fdekit/provider-ollama@0.4.4
  - @fdekit/provider-openai@0.4.4
  - @fdekit/runtime@0.4.4

## 0.4.3

### Patch Changes

- 0f8e226: command surface, s3 store and core governed-loop, validation gaps and DX/docs
- Updated dependencies [0f8e226]
  - @fdekit/console@0.4.3
  - @fdekit/core@0.4.3
  - @fdekit/runtime@0.4.3
  - @fdekit/provider-anthropic@0.4.3
  - @fdekit/provider-google@0.4.3
  - @fdekit/provider-ollama@0.4.3
  - @fdekit/provider-openai@0.4.3

## 0.4.2

### Patch Changes

- dbe7868: Simplify newly initialized projects around an env-selected provider, a minimal runnable agent config, clearer `.env.example` guidance, and a first-loop npm script. Config discovery and all file-creating workflows now keep deployment files, package/env mutations, recipes, and runtime output inside a contained `fdekit/` project, while preserving legacy root configs and invocation-relative recipe paths. The default runtime output and cache directory is now `artifacts/` instead of `.fdekit/`.
- c77f318: fdekit init scaffolding, simpler starter config
- Updated dependencies [dbe7868]
- Updated dependencies [c77f318]
  - @fdekit/core@0.4.2
  - @fdekit/runtime@0.4.2
  - @fdekit/console@0.4.2
  - @fdekit/provider-anthropic@0.4.2
  - @fdekit/provider-google@0.4.2
  - @fdekit/provider-ollama@0.4.2
  - @fdekit/provider-openai@0.4.2

## 0.4.1

### Patch Changes

- 558a126: patches for connectors, providers and environments: error handling, idempotency for tools and connectors, environments examples, tool error handling for providers
- Updated dependencies [558a126]
  - @fdekit/console@0.4.1
  - @fdekit/core@0.4.1
  - @fdekit/provider-anthropic@0.4.1
  - @fdekit/provider-google@0.4.1
  - @fdekit/provider-ollama@0.4.1
  - @fdekit/provider-openai@0.4.1
  - @fdekit/runtime@0.4.1

## 0.4.0

### Minor Changes

- 1e4afcc: command line fixes, improvements

### Patch Changes

- Updated dependencies [1e4afcc]
  - @fdekit/runtime@0.4.0
  - @fdekit/console@0.4.0
  - @fdekit/core@0.4.0
  - @fdekit/provider-anthropic@0.4.0
  - @fdekit/provider-google@0.4.0
  - @fdekit/provider-ollama@0.4.0
  - @fdekit/provider-openai@0.4.0

## 0.3.0

### Minor Changes

- 0cb6f4a: Add environment endpoint references: `environmentEndpoint('customer-api')` lets connectors resolve their base URL from the runtime environment's exported endpoints at tool-call time (via the new `ToolCallContext.runtimeEnvironment`), making the environment the single source of truth for customer API wiring. `fdekit validate` errors when a referenced endpoint is not exported. The support-triage scaffold drops its manual `CUSTOMER_API_URL` wiring and relies on the connector's call-time env resolution.
- 0cb6f4a: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.
- 0cb6f4a: Honor server `Retry-After` hints in `createHttpReq` (capped by the new `RetryPolicy.maxRetryAfterMs`, default 30s), accept injected official SDK clients in the OpenAI, Anthropic, and Google providers (`client` option, postgres-style optional peer dependencies), and bump default models to the current flagships (`claude-opus-4-8`, `gpt-5.5`, `gemini-3.5-flash`).

### Patch Changes

- 0cb6f4a: Derive scaffolded FDEKit dependency versions from the CLI package version and add the Changesets release workflow.
- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
  - @fdekit/core@0.3.0
  - @fdekit/runtime@0.3.0
  - @fdekit/provider-anthropic@0.3.0
  - @fdekit/provider-openai@0.3.0
  - @fdekit/provider-google@0.3.0
  - @fdekit/console@0.3.0
  - @fdekit/provider-ollama@0.3.0

## 0.2.0

### Minor Changes

- 16dc2da: Add environment endpoint references: `environmentEndpoint('customer-api')` lets connectors resolve their base URL from the runtime environment's exported endpoints at tool-call time (via the new `ToolCallContext.runtimeEnvironment`), making the environment the single source of truth for customer API wiring. `fdekit validate` errors when a referenced endpoint is not exported. The support-triage scaffold drops its manual `CUSTOMER_API_URL` wiring and relies on the connector's call-time env resolution.
- 16dc2da: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.
- 16dc2da: Honor server `Retry-After` hints in `createHttpReq` (capped by the new `RetryPolicy.maxRetryAfterMs`, default 30s), accept injected official SDK clients in the OpenAI, Anthropic, and Google providers (`client` option, postgres-style optional peer dependencies), and bump default models to the current flagships (`claude-opus-4-8`, `gpt-5.5`, `gemini-3.5-flash`).

### Patch Changes

- 16dc2da: Derive scaffolded FDEKit dependency versions from the CLI package version and add the Changesets release workflow.
- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
  - @fdekit/core@0.2.0
  - @fdekit/runtime@0.2.0
  - @fdekit/provider-anthropic@0.2.0
  - @fdekit/provider-openai@0.2.0
  - @fdekit/provider-google@0.2.0
  - @fdekit/console@0.2.0
  - @fdekit/provider-ollama@0.2.0
