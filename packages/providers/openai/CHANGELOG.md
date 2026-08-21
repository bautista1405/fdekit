# @fdekit/provider-openai

## 0.5.6

### Patch Changes

- @fdekit/core@0.5.6

## 0.5.5

### Patch Changes

- eebfa56: Normalize provider-reported token usage, pass runtime output-token limits into
  built-in provider requests, record measured or explicitly unknown usage for
  every inference step, estimate declared target cost, and enforce hard cost
  budgets without inventing unavailable telemetry. Normalized totals include
  provider-specific reasoning and cache activity, with optional cache-write
  pricing for exact budget enforcement.
- Updated dependencies [0aef42f]
- Updated dependencies [e9c43a7]
- Updated dependencies [98a9a9b]
- Updated dependencies [e36d267]
- Updated dependencies [eebfa56]
- Updated dependencies [eebfa56]
- Updated dependencies [1933233]
- Updated dependencies [eebfa56]
- Updated dependencies [eebfa56]
- Updated dependencies [eebfa56]
- Updated dependencies [d599da8]
- Updated dependencies [8826660]
  - @fdekit/core@0.5.5

## 0.5.4

### Patch Changes

- Updated dependencies [2d37d1f]
  - @fdekit/core@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies [d486e1b]
  - @fdekit/core@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies [0757ffc]
  - @fdekit/core@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [a5f7a9d]
  - @fdekit/core@0.5.1

## 0.5.0

### Patch Changes

- @fdekit/core@0.5.0

## 0.4.7

### Patch Changes

- ad31181: console report modifications, command and runtime-related small changes
- Updated dependencies [ad31181]
  - @fdekit/core@0.4.7

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
