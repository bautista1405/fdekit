# @fdekit/provider-mock

## Purpose

`@fdekit/provider-mock` provides a deterministic local provider adapter for demos, examples, and tests. It implements the FDEKit provider runtime contract without calling an external model API.

Use it when you need credential-free runs, predictable final answers, or custom planner behavior in tests.

## Who should use this package

- Deployment authors running local recipes with no API keys.
- Runtime test authors who need deterministic provider steps.
- Contributors validating agent-loop behavior without involving OpenAI, Anthropic, Google, or Ollama.

Choose a live provider package when you need real model behavior. Choose `@fdekit/runtime` when you want the built-in runtime export of the same mock adapter.

## 5-minute quick example

```ts
import { createMockProvider } from '@fdekit/provider-mock';
import { runAgent } from '@fdekit/runtime';

const result = await runAgent({
  deployment,
  projectDir: process.cwd(),
  agentName: 'supportTriage',
  input: { task: 'Explain the local run' },
  providerRegistry: {
    mock: createMockProvider({
      message: 'Mock provider completed the local run.',
    }),
  },
});

console.log(result.finalAnswer);
```

## Public API surface

Import from the package root:

```ts
import { createMockProvider } from '@fdekit/provider-mock';
import type { MockPlanner, MockProviderOptions } from '@fdekit/provider-mock';
```

The provider family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#providers).

## Stability/backward-compat notes

`@fdekit/provider-mock` is public but pre-1.0. Its root exports are `createMockProvider`, `MockPlanner`, and `MockProviderOptions`.

Subpath imports are internal. Planner behavior is deterministic by design and should remain suitable for tests and credential-free examples.

## See also

- Runtime execution API: [@fdekit/runtime](../../runtime/README.md)
- Authoring provider configs: [@fdekit/core](../../core/README.md)
- Provider family: [OpenAI](../openai/README.md), [Anthropic](../anthropic/README.md), [Google](../google/README.md), [Ollama](../ollama/README.md)
- CLI local workflow: [fdekit](../../cli/README.md)
