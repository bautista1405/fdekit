# Governed Exact Tool Sequences

`executeGovernedToolSequence()` is the runtime boundary for deterministic
orchestrators that already know the exact tool names and arguments they need to
execute. It does not invoke a model or let a provider revise the calls.

Every call still passes through the same edges as a provider-planned agent run:

- tool catalog availability and strict metadata checks;
- argument-schema and environment validation;
- deployment and agent policies;
- exact target-scoped approval fingerprints;
- audit, trace, and append-only session events;
- redaction before values enter governance artifacts.

## Pause and resume

The sequence persists its current exact call and all remaining calls when a
before-tool approval pauses execution. `resumeAgentRun()` executes the approved
call with the recorded arguments, then continues the recorded sequence without
provider planning. If a later call needs approval, the same run pauses again.

Completed calls are not replayed. This makes multi-system delivery safe for
flows such as posting a graded GitHub review and then notifying Slack.

```ts
const result = await executeGovernedToolSequence({
  deployment,
  projectDir,
  agentName: 'codebaseAgent',
  calls: [
    { toolName: 'github.review.post', args: review },
    { toolName: 'slack.notify', args: notification },
  ],
});
```

Handler failures stop the sequence before later calls run. The method does not
provide transactionality across external systems; connectors remain responsible
for their own idempotency, while the runtime guarantees exact pause/resume and
no in-run replay of already completed calls.
