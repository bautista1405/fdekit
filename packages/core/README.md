# @fdekit/core

## Purpose

`@fdekit/core` is the authoring contract for FDEKit deployments. It contains the TypeScript helpers and types used in `fde.config.ts`: deployments, agents, tools, connectors, providers, governance, evals, harnesses, recipes, workflow metadata, rollout metadata, schema helpers, policy helpers, and provider-planner contracts.

Use core when you are describing what a deployment is. Do not put runtime file I/O, artifact persistence, CLI behavior, or provider HTTP calls here.

## Who should use this package

- Deployment authors writing `fde.config.ts`.
- Connector and provider authors who need shared FDEKit contracts.
- Contributors changing public config shapes, policy helpers, eval assertions, or tool schema helpers.

Choose `@fdekit/runtime` instead when you need to load configs, run agents, write artifacts, or inspect traces. Choose `@fdekit/cli` when you only need the command-line workflow.

## 5-minute quick example

```ts
import {
  defineAgent,
  defineDeployment,
  defineEval,
  expectedFinalAnswer,
  expectedToolCall,
  providerFromEnv,
} from '@fdekit/core';

const provider = providerFromEnv();

export default defineDeployment({
  name: 'support-triage',
  environment: 'local',
  providers: {
    [provider.name]: provider,
  },
  agents: {
    supportTriage: defineAgent({
      provider: provider.name,
      instructions: './agents/support-triage.md',
    }),
  },
  evals: [
    defineEval({
      name: 'answers-support-request',
      agent: 'supportTriage',
      dataset: './evals/support-triage.json',
      assertions: [
        expectedToolCall('ticket.get'),
        expectedFinalAnswer(/support|ticket/i),
      ],
    }),
  ],
});
```

## Rubric judges

`judgeRubric` is a bring-your-own-judge assertion. FDEKit does not automatically call the
deployment provider or ship a built-in LLM judge. Pass a `judge` function that returns an
`EvalAssertionResult`; `fdekit validate` reports an error when the function is missing.

```ts
import { judgeRubric } from '@fdekit/core';

const answerQuality = judgeRubric({
  rubric: 'The answer is accurate, polite, and complete.',
  async judge(context, rubric) {
    // Call the model or deterministic judge selected for your eval environment.
    const passed = Boolean(context.finalAnswer?.includes('please'));

    return {
      passed,
      score: passed ? 1 : 0,
      message: passed ? `Passed: ${rubric}` : `Failed: ${rubric}`,
    };
  },
});
```

## Public API surface

Import from the package root:

```ts
import { defineDeployment, defineTool, objectArgs } from '@fdekit/core';
```

The API reference documents all public root exports, including `defineDeployment`, `defineAgent`, `providerFromEnv`, `defineConnector`, `defineTool`, `defineEval`, `objectArgs`, policy helpers, eval assertions, and public config/provider/tool types: [Core API Reference](../../docs/api/core.md).

## Stability/backward-compat notes

`@fdekit/core` is public but pre-1.0. Package-root exports are the compatibility boundary. Subpath imports from `src`, `dist`, `helpers`, or `interfaces` are internal and may change without a public migration note.

Breaking changes to core types or helper behavior should update the API reference and relevant cookbooks because deployment configs depend on this package.

## See also

- Runtime execution: [@fdekit/runtime](../runtime/README.md)
- CLI workflow: [fdekit](../cli/README.md)
- Static dashboard renderer: [@fdekit/console](../console/README.md)
- Provider packages: [mock](../providers/mock/README.md), [OpenAI](../providers/openai/README.md), [Anthropic](../providers/anthropic/README.md), [Google](../providers/google/README.md), [Ollama](../providers/ollama/README.md)
- Connector packages: [customer API](../connectors/customer-api/README.md), [codebase](../connectors/codebase/README.md), [GitHub](../connectors/github/README.md), [Slack](../connectors/slack/README.md), [Jira](../connectors/jira/README.md), [Linear](../connectors/linear/README.md), [Postgres](../connectors/postgres/README.md), [k6](../connectors/k6/README.md), [HubSpot](../connectors/hubspot/README.md), [Salesforce](../connectors/salesforce/README.md)
- Environment packages: [Docker](../environments/docker/README.md), [Floci](../environments/floci/README.md)
