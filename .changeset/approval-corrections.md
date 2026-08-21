---
'@fdekit/core': patch
'@fdekit/runtime': patch
'@fdekit/cli': patch
'@fdekit/console': patch
---

Add a correct-before-approve flow that validates replacement tool arguments,
supersedes the pending request, issues a fresh exact approval fingerprint, and
resumes only against the corrected request.
