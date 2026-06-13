# @fdekit/provider-google

## Purpose

`@fdekit/provider-google` provides the Google Gemini config helper and runtime adapter for FDEKit. The config helper adds provider metadata to `fde.config.ts`; the runtime adapter calls the Gemini `generateContent` API and parses the next FDEKit loop step.

Use it when an FDEKit deployment should run against Google Gemini models.

## Who should use this package

- Deployment authors selecting Google Gemini as a model provider.
- Runtime integrators who want to pass a Google adapter through a provider registry.
- Contributors maintaining provider request/response parsing and resilience behavior.

Choose `@fdekit/core` for provider contracts and `@fdekit/runtime` for agent-loop execution.

## 5-minute quick example

```ts
import { defineDeployment } from '@fdekit/core';
import { googleProvider } from '@fdekit/provider-google';

export default defineDeployment({
  name: 'google-support-triage',
  environment: 'local',
  providers: {
    google: googleProvider({
      model: 'gemini-3.5-flash',
    }),
  },
  agents: {
    // ...
  },
});
```

Set `GEMINI_API_KEY` before running the deployment.

## Use the official SDK client (optional)

Instead of FDEKit's raw HTTP path, you can inject the official SDK client. The injected client owns auth, retries, and timeouts, and the API key env var is no longer required by `fdekit doctor`/`validate`:

```ts
import { GoogleGenAI } from '@google/genai';
import { googleProvider } from '@fdekit/provider-google';

const provider = googleProvider({
  model: 'gemini-3.5-flash',
  client: new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
});
```

Install the SDK yourself — it is an optional peer dependency:

```bash
npm install @google/genai
```

Any object matching the `GoogleGenAIClient` structural type works, which keeps custom gateways and test fakes injectable.

## Public API surface

Import from the package root:

```ts
import { googleProvider, geminiProvider, createGoogleProvider } from '@fdekit/provider-google';
import type { GoogleGenAIClient, GoogleProviderOptions, GoogleRuntimeOptions } from '@fdekit/provider-google';
```

The provider family is summarized in the public API index: [Public API Reference](../../../docs/api-reference.md#providers).

## Stability/backward-compat notes

`@fdekit/provider-google` is public but pre-1.0. Its root exports are `googleProvider`, `geminiProvider`, `createGoogleProvider`, `GoogleGenAIClient`, `GoogleProviderOptions`, and `GoogleRuntimeOptions`.

Subpath imports are internal. Config defaults, env var names, and the FDEKit provider-step JSON contract are the compatibility-sensitive parts.

## See also

- Provider contracts: [@fdekit/core](../../core/README.md)
- Runtime execution: [@fdekit/runtime](../../runtime/README.md)
- Provider family: [mock](../mock/README.md), [OpenAI](../openai/README.md), [Anthropic](../anthropic/README.md), [Ollama](../ollama/README.md)
- CLI workflow: [fdekit](../../cli/README.md)
