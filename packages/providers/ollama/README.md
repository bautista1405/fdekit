# @fdekit/provider-ollama

## Purpose

`@fdekit/provider-ollama` provides local Ollama config helpers and a runtime adapter for FDEKit. It calls the local Ollama chat API and parses the next FDEKit loop step.

Use it when an FDEKit deployment should run against a local model server instead of a hosted provider.

## Who should use this package

- Deployment authors running local or offline model experiments.
- Runtime integrators who want to pass an Ollama adapter through a provider registry.
- Contributors maintaining provider request/response parsing and resilience behavior.

Choose `@fdekit/provider-mock` for deterministic no-model tests and hosted provider packages for cloud model APIs.

## 5-minute quick example

```bash
ollama pull llama3.1:8b
ollama serve
```

```ts
import { defineDeployment } from '@fdekit/core';
import { localOllamaProvider } from '@fdekit/provider-ollama';

export default defineDeployment({
  name: 'ollama-support-triage',
  environment: 'local',
  providers: {
    localOllama: localOllamaProvider({
      model: process.env.FDEKIT_MODEL || 'llama3.1:8b',
      apiBaseUrl: process.env.OLLAMA_BASE_URL,
    }),
  },
  agents: {
    // ...
  },
});
```

## Public API surface

Import from the package root:

```ts
import { localOllamaProvider, ollamaProvider, createOllamaProvider } from '@fdekit/provider-ollama';
import type { OllamaProviderOptions, OllamaRuntimeOptions } from '@fdekit/provider-ollama';
```

The provider family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#providers).

## Stability/backward-compat notes

`@fdekit/provider-ollama` is public but pre-1.0. Its root exports are `localOllamaProvider`, `ollamaProvider`, `createOllamaProvider`, `OllamaProviderOptions`, and `OllamaRuntimeOptions`.

Subpath imports are internal. Config defaults, env var names, and the FDEKit provider-step JSON contract are the compatibility-sensitive parts.

## See also

- Provider contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- Provider family: [mock](../mock/README.md), [OpenAI](../openai/README.md), [Anthropic](../anthropic/README.md), [Google](../google/README.md)
- CLI workflow: [fdekit](../../cli/README.md)
