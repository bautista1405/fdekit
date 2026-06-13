---
"@fdekit/core": minor
"@fdekit/runtime": minor
"@fdekit/connector-customer-api": minor
"@fdekit/environment-docker": patch
"@fdekit/environment-floci": patch
"fdekit": minor
---

Validate environment wiring: `fdekit validate` now warns when the customer-api connector base URL disagrees with the runtime environment's declared customer API URL, and when live connector modes or non-local URLs run under the `local` environment label. The customer-api connector resolves `CUSTOMER_API_URL` at call time, and the duplicated docker/floci `shellEscape`/`mergeEnv` helpers moved into `@fdekit/core`.
