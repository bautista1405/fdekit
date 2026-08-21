---
'@fdekit/core': patch
'@fdekit/runtime': patch
'@fdekit/provider-openai': patch
'@fdekit/provider-anthropic': patch
'@fdekit/provider-google': patch
'@fdekit/provider-ollama': patch
---

Normalize provider-reported token usage, pass runtime output-token limits into
built-in provider requests, record measured or explicitly unknown usage for
every inference step, estimate declared target cost, and enforce hard cost
budgets without inventing unavailable telemetry. Normalized totals include
provider-specific reasoning and cache activity, with optional cache-write
pricing for exact budget enforcement.
