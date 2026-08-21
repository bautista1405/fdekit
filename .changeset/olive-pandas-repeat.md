---
"@fdekit/cli": patch
---

Make the deployment artifacts describe the run they actually reviewed, and report governance enforcement honestly.

- Reports and the console now pick the run with the most evidence - approvals, completed tool calls, policy decisions - instead of whichever trace was written last. A smoke run that happened to go last was displacing the governed run that cleared three approvals and filed an issue, so the stakeholder artifact read "Created issues: none captured" for a deployment that had created one.
- Governance enforcement is derived from approval gates firing and policies denying calls, not from `--strict`. Strict mode only controls runtime edge validation, so a run where three external writes were blocked pending named human approval was reporting "advisory mode - not enforced" and "0 enforced control(s) passing".
- Console panels state their scope. The workflow map covers the reviewed run and integration readiness covers every retained run, which previously let one page say no issue had been created while the panel beside it counted the call that created it.
- `fdekit recipe install` retargets the scaffold's `agent` script at the recipe's run command, so the command `fdekit init` recommends stops answering "No ticket id was provided" with no tool calls. Scripts the user has edited are left alone.
