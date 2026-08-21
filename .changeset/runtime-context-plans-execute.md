---
'@fdekit/core': patch
'@fdekit/runtime': patch
---

Make policy-aware context plans load-bearing in agent runs by routing through
selected inference endpoints and models, exposing only compiled model context
to provider planners, enforcing planned tool and duration budgets, recording
redacted durable plan evidence, and preserving plans across approval resume.
