# @fdekit/provider-openai

## 0.4.6

### Patch Changes

- @fdekit/core@0.4.6

## 0.4.5

### Patch Changes

- f1919a1: take connectors variables from .env, search by substring on codebase.search, use the correct labels for jira and linear
- Updated dependencies [f1919a1]
  - @fdekit/core@0.4.5

## 0.4.4

### Patch Changes

- d1d9280: validate connectors, polish commands, runs and evidence with k6, s3 client validation
- Updated dependencies [d1d9280]
  - @fdekit/core@0.4.4

## 0.4.3

### Patch Changes

- Updated dependencies [0f8e226]
  - @fdekit/core@0.4.3

## 0.4.2

### Patch Changes

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

### Patch Changes

- @fdekit/core@0.4.0

## 0.3.0

### Minor Changes

- 0cb6f4a: Honor server `Retry-After` hints in `createHttpReq` (capped by the new `RetryPolicy.maxRetryAfterMs`, default 30s), accept injected official SDK clients in the OpenAI, Anthropic, and Google providers (`client` option, postgres-style optional peer dependencies), and bump default models to the current flagships (`claude-opus-4-8`, `gpt-5.5`, `gemini-3.5-flash`).

### Patch Changes

- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
- Updated dependencies [0cb6f4a]
  - @fdekit/core@0.3.0

## 0.2.0

### Minor Changes

- 16dc2da: Honor server `Retry-After` hints in `createHttpReq` (capped by the new `RetryPolicy.maxRetryAfterMs`, default 30s), accept injected official SDK clients in the OpenAI, Anthropic, and Google providers (`client` option, postgres-style optional peer dependencies), and bump default models to the current flagships (`claude-opus-4-8`, `gpt-5.5`, `gemini-3.5-flash`).

### Patch Changes

- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
- Updated dependencies [16dc2da]
  - @fdekit/core@0.2.0
