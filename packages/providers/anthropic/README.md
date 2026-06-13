# @fdekit/provider-anthropic

## Purpose

`@fdekit/provider-anthropic` provides the Anthropic config helper and runtime adapter for FDEKit. The config helper adds provider metadata to `fde.config.ts`; the runtime adapter calls the Anthropic Messages API and parses the next FDEKit loop step.

Use it when an FDEKit deployment should run against Anthropic Claude models.

## Who should use this package

- Deployment authors selecting Anthropic as a model provider.
- Runtime integrators who want to pass an Anthropic adapter through a provider registry.
- Contributors maintaining provider request/response parsing and resilience behavior.

Choose `@fdekit/core` for provider contracts and `@fdekit/runtime` for agent-loop execution.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { anthropicProvider } from '@fdekit/provider-anthropic';

export default defineDeployment({
  name: 'anthropic-support-triage',
  environment: 'local',
  providers: {
    anthropic: anthropicProvider({
      model: 'claude-opus-4-8',
    }),
  },
  agents: {
    // ...
  },
});
```

Set `ANTHROPIC_API_KEY` before running the deployment.

## Use the official SDK client (optional)

Instead of FDEKit's raw HTTP path, you can inject the official SDK client. The injected client owns auth, retries, and timeouts, and the API key env var is no longer required by `fdekit doctor`/`validate`:

```ts
import Anthropic from '@anthropic-ai/sdk';
import { anthropicProvider } from '@fdekit/provider-anthropic';

const provider = anthropicProvider({
  model: 'claude-opus-4-8',
  client: new Anthropic(),
});
```

Install the SDK yourself — it is an optional peer dependency:

```bash
npm install @anthropic-ai/sdk
```

Any object matching the `AnthropicMessagesClient` structural type works, which keeps custom gateways and test fakes injectable.

## Public API surface

Import from the package root:

```ts
import { anthropicProvider, createAnthropicProvider } from '@fdekit/provider-anthropic';
import type { AnthropicMessagesClient, AnthropicProviderOptions, AnthropicRuntimeOptions } from '@fdekit/provider-anthropic';
```

The provider family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#providers).

## Stability/backward-compat notes

`@fdekit/provider-anthropic` is public but pre-1.0. Its root exports are `anthropicProvider`, `createAnthropicProvider`, `AnthropicMessagesClient`, `AnthropicProviderOptions`, and `AnthropicRuntimeOptions`.

Subpath imports are internal. Config defaults, env var names, and the FDEKit provider-step JSON contract are the compatibility-sensitive parts.

## See also

- Provider contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- Provider family: [mock](../mock/README.md), [OpenAI](../openai/README.md), [Google](../google/README.md), [Ollama](../ollama/README.md)
- CLI workflow: [fdekit](../../cli/README.md)
