---
'@fdekit/runtime': patch
---

Add opt-in execution-backend, disposable workspace, and expiring credential
lease contracts with a constrained local implementation that enforces command
and environment allowlists, time and output limits, cleanup, and fail-closed
isolation requirements without expanding the starter configuration.
