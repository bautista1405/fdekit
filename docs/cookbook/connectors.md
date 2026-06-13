# Connector Cookbook

This cookbook shows the pattern for bringing FDEKit into a customer repo without waiting for a first-party connector package.

## Pattern: BYO Connector In A Customer Repo

Use this when the customer has an internal API, repo-specific review workflow, or business action that does not fit a built-in connector.

The shape is:

1. Add any built-in connector that gives the agent useful context.
2. Add a custom connector with one or more customer-specific tools.
3. Give each tool a stable name, semantic `category`/`tags`, explicit scopes, environment limits, and typed args.
4. Tell the agent exactly when to call those tools.
5. Add eval assertions that prove the custom tool was used.

## Example: Flag TypeScript `any` In A Customer API Repo

This example lets an agent inspect a customer API repository and record every `any` usage it believes should be reviewed.

### `fde.config.ts`

```ts
import {
  arrayArg,
  defineAgent,
  defineConnector,
  defineDeployment,
  defineEval,
  defineTool,
  expectedFinalAnswer,
  expectedToolCall,
  integerArg,
  maxLatency,
  noPolicyViolation,
  objectArgs,
  stringArg,
} from '@fdekit/core';
import { codebaseConnector } from '@fdekit/connector-codebase';

const codebase = codebaseConnector({
  rootDir: process.env.CODEBASE_ROOT ?? '.',
});

const flagAnyTypesArgs = objectArgs({
  findings: arrayArg(objectArgs({
    filePath: stringArg({ description: 'File path relative to CODEBASE_ROOT.' }),
    line: integerArg({ description: '1-based line number.', minimum: 1 }),
    reason: stringArg({ description: 'Why this any usage should be reviewed.' }),
  }, {
    required: ['filePath', 'line', 'reason'] as const,
  })),
}, {
  required: ['findings'] as const,
});

const codeQuality = defineConnector({
  name: 'code-quality',
  description: 'Customer-specific code review tools.',
  tools: [
    defineTool({
      name: 'flag-any-types',
      description: 'Record TypeScript any usages that should be reviewed before deployment.',
      scopes: ['codebase:write'],
      environments: ['local', 'development', 'staging'],
      category: 'codebase',
      tags: ['action', 'review-handoff'],
      argsSchema: flagAnyTypesArgs,
      handler(args) {
        return {
          status: 'flagged',
          count: args.findings.length,
          findings: args.findings,
        };
      },
    }),
  ],
});

export default defineDeployment({
  name: 'customer-api-review',
  environment: 'local',
  providers: {
    mock: { name: 'mock', model: 'codebase-review-local' },
  },
  connectors: {
    codebase,
    codeQuality,
  },
  agents: {
    apiReviewer: defineAgent({
      provider: 'mock',
      instructions: './agents/api-reviewer.md',
    }),
  },
  evals: [
    defineEval({
      name: 'flags-any-types',
      agent: 'apiReviewer',
      dataset: './evals/api-review.json',
      maxSteps: 6,
      assertions: [
        expectedToolCall('codebase.search'),
        expectedToolCall('codebase.readFile'),
        expectedToolCall('flag-any-types'),
        expectedFinalAnswer(/any|flagged/i),
        noPolicyViolation(),
        maxLatency(10000),
      ],
    }),
  ],
});
```

API reference: [`defineDeployment`](../api/core.md#definedeployment), [`defineConnector`](../api/core.md#defineconnector), [`defineTool`](../api/core.md#definetool), [`objectArgs`](../api/core.md#objectargs), [`defineEval`](../api/core.md#defineeval), and [`expectedToolCall`](../api/core.md#expectedtoolcall).

### `agents/api-reviewer.md`

```md
Search the customer API codebase for TypeScript `any` usage.
Use `codebase.search` first.
Use `codebase.readFile` to inspect matching files.
Call `flag-any-types` with each file, line, and reason.
Finish with a concise summary that mentions the number of flagged findings.
```

API reference: [`AgentConfig`](../api/core.md#agentconfig) is the deployment contract that points an agent at instructions files like this one.

### `evals/api-review.json`

```json
[
  {
    "name": "flags-any-usage",
    "input": {
      "task": "Find any TypeScript any usage that should be reviewed.",
      "query": "any"
    },
    "expected": {
      "shouldFlagAnyTypes": true
    }
  }
]
```

API reference: [`EvalCase`](../api/core.md#evalcase) and [`EvalDefinition`](../api/core.md#evaldefinition) describe how dataset rows connect to eval suites.

### Run It

```bash
fdekit validate
CODEBASE_ROOT=/path/to/customer-api-repo fdekit run apiReviewer --input '{"task":"Find TypeScript any usage","query":"any"}'
fdekit eval run
fdekit console
```

CLI reference: [`fdekit validate`](../api/cli.md#fdekit-validate-json-strict), [`fdekit run`](../api/cli.md#fdekit-run-agent-input-json-strict), [`fdekit eval run`](../api/cli.md#fdekit-eval-run), and [`fdekit console`](../api/cli.md#fdekit-console).

Eval runs use the `maxSteps` value from `defineEval()`. Leave enough room for search, read, custom tool call, and final answer. A too-low `maxSteps` can fail before the agent reaches `flag-any-types`.

After changing tool scopes, env requirements, datasets, or connector behavior, run `fdekit diff` before the next handoff to see what changed since the last validated snapshot.

CLI reference: [`fdekit diff`](../api/cli.md#fdekit-diff-from-snapshot-to-config-or-snapshot).

## When To Promote A Custom Connector

Keep a connector local to the customer repo when it is specific to one customer.

Promote it into `packages/connectors/*` when:

- multiple recipes need it,
- multiple customer deployments share the same API shape,
- it needs its own tests and README,
- it should expose stable common tools such as `issue.create` or `crm.note.create`.

## Next Step

If you just built a custom connector, read the [Public API Reference](../api-reference.md) to confirm package boundaries, then read the [Local Environment Cookbook](./local-environments.md) if the connector depends on a customer-like API or local cloud environment around the agent.
