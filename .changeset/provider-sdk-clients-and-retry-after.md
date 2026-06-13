---
"@fdekit/core": minor
"@fdekit/provider-anthropic": minor
"@fdekit/provider-openai": minor
"@fdekit/provider-google": minor
"fdekit": minor
---

Honor server `Retry-After` hints in `createHttpReq` (capped by the new `RetryPolicy.maxRetryAfterMs`, default 30s), accept injected official SDK clients in the OpenAI, Anthropic, and Google providers (`client` option, postgres-style optional peer dependencies), and bump default models to the current flagships (`claude-opus-4-8`, `gpt-5.5`, `gemini-3.5-flash`).
