# @fdekit/core

## 0.3.0

### Minor Changes

- 0cb6f4a: Add environment endpoint references: `environmentEndpoint('customer-api')` lets connectors resolve their base URL from the runtime environment's exported endpoints at tool-call time (via the new `ToolCallContext.runtimeEnvironment`), making the environment the single source of truth for customer API wiring. `fdekit validate` errors when a referenced endpoint is not exported. The support-triage scaffold drops its manual `CUSTOMER_API_URL` wiring and relies on the connector's call-time env resolution.
- 0cb6f4a: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.
- 0cb6f4a: Honor server `Retry-After` hints in `createHttpReq` (capped by the new `RetryPolicy.maxRetryAfterMs`, default 30s), accept injected official SDK clients in the OpenAI, Anthropic, and Google providers (`client` option, postgres-style optional peer dependencies), and bump default models to the current flagships (`claude-opus-4-8`, `gpt-5.5`, `gemini-3.5-flash`).

## 0.2.0

### Minor Changes

- 16dc2da: Add environment endpoint references: `environmentEndpoint('customer-api')` lets connectors resolve their base URL from the runtime environment's exported endpoints at tool-call time (via the new `ToolCallContext.runtimeEnvironment`), making the environment the single source of truth for customer API wiring. `fdekit validate` errors when a referenced endpoint is not exported. The support-triage scaffold drops its manual `CUSTOMER_API_URL` wiring and relies on the connector's call-time env resolution.
- 16dc2da: Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.
- 16dc2da: Honor server `Retry-After` hints in `createHttpReq` (capped by the new `RetryPolicy.maxRetryAfterMs`, default 30s), accept injected official SDK clients in the OpenAI, Anthropic, and Google providers (`client` option, postgres-style optional peer dependencies), and bump default models to the current flagships (`claude-opus-4-8`, `gpt-5.5`, `gemini-3.5-flash`).
