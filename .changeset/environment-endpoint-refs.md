---
"@fdekit/core": minor
"@fdekit/runtime": minor
"@fdekit/connector-customer-api": minor
"@fdekit/cli": minor
---

Add environment endpoint references: `environmentEndpoint('customer-api')` lets connectors resolve their base URL from the runtime environment's exported endpoints at tool-call time (via the new `ToolCallContext.runtimeEnvironment`), making the environment the single source of truth for customer API wiring. `fdekit validate` errors when a referenced endpoint is not exported. The support-triage scaffold drops its manual `CUSTOMER_API_URL` wiring and relies on the connector's call-time env resolution.
