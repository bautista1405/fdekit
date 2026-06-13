# @fdekit/provider-openai

## Purpose

`@fdekit/provider-openai` provides the OpenAI config helper and runtime adapter for FDEKit. The config helper adds provider metadata to `fde.config.ts`; the runtime adapter calls the OpenAI Responses API and parses the next FDEKit loop step.

Use it when an FDEKit deployment should run against OpenAI models.

## Who should use this package

- Deployment authors selecting OpenAI as a model provider.
- Runtime integrators who want to pass an OpenAI adapter through a provider registry.
- Contributors maintaining provider request/response parsing and resilience behavior.

Choose `@fdekit/core` for provider contracts and `@fdekit/runtime` for agent-loop execution.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { openaiProvider } from '@fdekit/provider-openai';

export default defineDeployment({
  name: 'openai-support-triage',
  environment: 'local',
  providers: {
    openai: openaiProvider({
      model: 'gpt-5.5',
    }),
  },
  agents: {
    // ...
  },
});
```

Set `OPENAI_API_KEY` before running the deployment.

## Use the official SDK client (optional)

Instead of FDEKit's raw HTTP path, you can inject the official SDK client. The injected client owns auth, retries, and timeouts, and the API key env var is no longer required by `fdekit doctor`/`validate`:

```ts
import OpenAI from 'openai';
import { openaiProvider } from '@fdekit/provider-openai';

const provider = openaiProvider({
  model: 'gpt-5.5',
  client: new OpenAI(),
});
```

Install the SDK yourself — it is an optional peer dependency:

```bash
npm install openai
```

Any object matching the `OpenAIResponsesClient` structural type works, which keeps custom gateways and test fakes injectable.

## Public API surface

Import from the package root:

```ts
import { openaiProvider, createOpenAIProvider } from '@fdekit/provider-openai';
import type { OpenAIProviderOptions, OpenAIResponsesClient, OpenAIRuntimeOptions } from '@fdekit/provider-openai';
```

The provider family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#providers).

## Stability/backward-compat notes

`@fdekit/provider-openai` is public but pre-1.0. Its root exports are `openaiProvider`, `createOpenAIProvider`, `OpenAIResponsesClient`, `OpenAIProviderOptions`, and `OpenAIRuntimeOptions`.

Subpath imports are internal. Config defaults, env var names, and the FDEKit provider-step JSON contract are the compatibility-sensitive parts.

## See also

- Provider contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- Provider family: [mock](../mock/README.md), [Anthropic](../anthropic/README.md), [Google](../google/README.md), [Ollama](../ollama/README.md)
- CLI workflow: [fdekit](../../cli/README.md)
