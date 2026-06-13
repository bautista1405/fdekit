# Provider Step and Tool Schema Spec

This document formalizes the contract between an FDEKit runtime provider, the agent loop, and tool definitions.

The short version:

- providers return one step at a time,
- each step is either a tool call or a final answer,
- tool-call args must match the selected tool `argsSchema`,
- strict validation and strict runtime runs require every tool to declare `argsSchema`, `scopes`, and `environments`.

## Provider Step Contract

Runtime providers implement the `AgentProvider` contract from `@fdekit/core`.

```ts
interface AgentProvider {
  name: string;
  planNextStep: (context: ProviderPlanContext) => MaybePromise<ProviderStep>;
}
```

`planNextStep()` receives deployment context, agent instructions, user input, previous tool results, and step counters. It must return exactly one `ProviderStep`.

## Step Types

### Tool Call Step

Use this when the provider wants the runtime to execute a tool.

```ts
interface ProviderToolCallStep {
  type: 'tool_call';
  toolName: string;
  args: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
}
```

JSON shape:

```json
{
  "type": "tool_call",
  "toolName": "customer.get",
  "args": {
    "customerId": "cust_123"
  },
  "reason": "Need account context before triage."
}
```

Rules:

- `type` must be exactly `tool_call`.
- `toolName` must match one available tool by exact name.
- `args` must be an object.
- `args` should contain every property required by the tool `argsSchema`.
- `args` should not contain unrelated properties unless the schema allows them.
- `reason` should be short and useful for traces.
- `metadata` must be JSON-serializable.

### Final Step

Use this when the provider is done.

```ts
interface ProviderFinalStep {
  type: 'final';
  message: string;
  metadata?: Record<string, unknown>;
}
```

JSON shape:

```json
{
  "type": "final",
  "message": "The ticket should be escalated because the customer is blocked on renewal."
}
```

Rules:

- `type` must be exactly `final`.
- `message` must be a human-readable answer.
- `metadata` must be JSON-serializable.

## Provider Text Output Format

OpenAI, Anthropic, Google Gemini, and Ollama adapters currently ask the model to emit a JSON object that matches one of the step shapes above.

The model response should be parseable as JSON with no Markdown fence:

```json
{
  "type": "tool_call",
  "toolName": "issue.create",
  "args": {
    "title": "Billing access outage for renewal-blocking account",
    "body": "Customer cannot access billing and renewal is blocked.",
    "priority": "urgent"
  }
}
```

Avoid:

````md
```json
{ "type": "tool_call" }
```
````

Avoid extra prose before or after the JSON object.

## Tool Args Schema Contract

Every production-ready tool should declare `argsSchema`.

```ts
import { defineTool, objectArgs, stringArg } from '@fdekit/core';

const createIssueArgs = objectArgs({
  title: stringArg({ description: 'Short issue title.' }),
  body: stringArg({ description: 'Issue body with evidence and requested follow-up.' }),
  priority: stringArg({ description: 'Optional priority label.' }),
}, {
  required: ['title', 'body'] as const,
});

export const createIssueTool = defineTool({
  name: 'issue.create',
  description: 'Create an engineering issue.',
  scopes: ['issues:write'],
  environments: ['staging', 'production'],
  category: 'issue',
  tags: ['action', 'escalation', 'issue'],
  argsSchema: createIssueArgs,
  handler(args) {
    return { ok: true, title: args.title };
  },
});
```

Minimum schema rules:

- root schema should be an object,
- every required property should be listed in `required`,
- each property should have a concrete JSON Schema type,
- descriptions should tell the model what to pass,
- write tools should avoid broad catch-all args,
- production tools should set `additionalProperties: false` unless extra args are intentional.

FDEKit's `objectArgs()` helper defaults `additionalProperties` to `false`.

## Validation Behavior

`fdekit validate` checks tool metadata. Standard mode is permissive for prototypes. Strict mode is explicit and should be used before handoff or promotion.

| Context | Missing `argsSchema` | Missing `scopes` | Missing `environments` |
| --- | --- | --- | --- |
| `fdekit validate` | Warning | Warning | Warning |
| `fdekit validate --strict` | Error | Error | Error |
| `validateDeployment(deployment, { strict: true })` | Error | Error | Error |
| `validateDeployment(deployment, { requireToolArgsSchema: true })` | Error | Warning | Warning |

`deployment.environment === 'production'` does not silently enable strict mode. The flag is intentionally explicit so CI, handoff scripts, and local reproductions all use the same switch.

## Runtime Edge Behavior

The runtime enforces declared schemas and environments at the tool edge before a handler runs.

In standard mode:

- missing `argsSchema`, `scopes`, or `environments` do not block a run,
- declared `argsSchema` still validates provider-planned args,
- declared `environments` still restrict where the tool can run,
- governance policies still enforce approvals, budgets, scopes, redaction, and PII checks when configured.

In strict mode:

- `runAgent({ strict: true })` and `fdekit run <agent> --strict` require every available tool to declare `argsSchema`, `scopes`, and `environments`,
- the runtime blocks before tool handlers when strict metadata is missing,
- malformed tool args are blocked before handler execution,
- traces include `runtime.edge.profile` and edge block events such as `tool.schema.blocked`.

Tool `category` and `tags` are not strict-mode requirements, but they are part of the provider-visible tool metadata. Use them to describe behavior semantics such as `escalation`, `crm-handoff`, `codebase`, or `load-test`. Runtime evals and macro-evals use those semantics instead of hard-coded connector tool names.

## Provider Author Checklist

When implementing or customizing a provider adapter:

- Return only `ProviderToolCallStep` or `ProviderFinalStep`.
- Parse model output defensively.
- Reject unknown step types.
- Treat malformed JSON as a failed provider step, not as a tool call.
- Preserve `reason` and useful metadata for traces.
- Include available tools and their `argsSchema` in the model context.
- Tell the model that tool-call args must match `argsSchema`.
- Keep retries/circuit breakers around external provider HTTP calls, not around runtime tool execution.

## Tool Author Checklist

When implementing a connector or custom tool:

- Declare `argsSchema`.
- Declare `scopes`.
- Declare `environments` for write tools.
- Declare `category` and `tags` for behavior semantics that runtime analysis should understand.
- Keep tool names stable and specific.
- Prefer common tool names for the easy rung, such as `issue.create` or `crm.note.create`.
- Keep native tool names available for advanced use, such as `jira.issue.create`.
- Validate dangerous args again inside the handler when they affect security.
- Make write operations idempotent where the external API supports it.

## Why This Matters

Provider output is model-authored, so the runtime boundary must be boring and explicit. The provider step contract tells the model what to emit. The tool schema contract tells the model what arguments are valid. Strict validation makes missing schemas visible before a production rollout.

## Next Step

If you just implemented or reviewed a provider/tool schema, read the [Connector Cookbook](../cookbook/connectors.md) for customer tool examples and the [Production Hardening Guide](../production-hardening.md) for strict-mode rollout expectations.
