import type { AddScaffold, CatalogEnvVar, ProviderManifest } from './types.js';
import { fdekitDependency } from '../package-versions.js';

const ollamaEnv: CatalogEnvVar[] = [
  {
    name: 'OLLAMA_BASE_URL',
    description: 'Optional local Ollama server URL override',
  },
  {
    name: 'FDEKIT_MODEL',
    value: 'llama3.1:8b',
    description: 'Model override for the selected provider',
  },
];

const googleScaffold: AddScaffold = {
  key: 'google',
  expression: "googleProvider({ model: process.env.FDEKIT_MODEL || 'gemini-3.5-flash' })",
  imports: [
    { moduleName: '@fdekit/provider-google', names: ['googleProvider'] },
  ],
  dependencies: fdekitDependency('@fdekit/provider-google'),
  env: [
    {
      name: 'GEMINI_API_KEY',
      description: 'Google Gemini API key for live provider runs',
    },
  ],
};

export const providerManifests: ProviderManifest[] = [
  {
    kind: 'provider',
    id: 'mock',
    displayName: 'Mock',
    packageName: '@fdekit/provider-mock',
    configFactory: 'mock',
    runtimeAdapter: 'createMockProvider()',
    maturity: 'Ready',
    supportNote: 'Credential-free deterministic provider for recipes, evals, demos, and CI',
    packagePurpose: 'Deterministic local provider for tests and demos',
    systemDependency: 'No external dependency',
    scaffold: {
      key: 'mock',
      expression: "{ name: 'mock', model: 'support-triage-local' }",
      dependencies: fdekitDependency('@fdekit/provider-mock'),
    },
  },
  {
    kind: 'provider',
    id: 'localOllama',
    displayName: 'Local Ollama',
    packageName: '@fdekit/provider-ollama',
    configFactory: 'localOllamaProvider()',
    runtimeAdapter: 'createOllamaProvider()',
    maturity: 'Beta',
    supportNote: 'Talks to a local Ollama server, defaulting to `http://127.0.0.1:11434`; model quality depends on the selected local model',
    packagePurpose: 'Local Ollama provider',
    systemDependency: 'Run Ollama separately and point `OLLAMA_BASE_URL` at it when needed',
    scaffold: {
      key: 'localOllama',
      expression: `localOllamaProvider({
  model: process.env.FDEKIT_MODEL || 'llama3.1:8b',
  apiBaseUrl: process.env.OLLAMA_BASE_URL,
})`,
      imports: [
        { moduleName: '@fdekit/provider-ollama', names: ['localOllamaProvider'] },
      ],
      dependencies: fdekitDependency('@fdekit/provider-ollama'),
      env: ollamaEnv,
      note: 'Run `ollama pull llama3.1:8b` and `ollama serve` before using the localOllama provider',
    },
    aliases: [
      {
        name: 'ollama',
        scaffold: {
          key: 'ollama',
          expression: `ollamaProvider({
  model: process.env.FDEKIT_MODEL || 'llama3.1:8b',
  apiBaseUrl: process.env.OLLAMA_BASE_URL,
})`,
          imports: [
            { moduleName: '@fdekit/provider-ollama', names: ['ollamaProvider'] },
          ],
          dependencies: fdekitDependency('@fdekit/provider-ollama'),
          env: ollamaEnv,
          note: 'Run `ollama pull llama3.1:8b` and `ollama serve` before using the Ollama provider',
        },
      },
    ],
  },
  {
    kind: 'provider',
    id: 'openai',
    displayName: 'OpenAI',
    packageName: '@fdekit/provider-openai',
    configFactory: 'openaiProvider()',
    runtimeAdapter: 'createOpenAIProvider()',
    maturity: 'Beta',
    supportNote: 'Uses `OPENAI_API_KEY` by default, supports custom API base URLs or an injected official `openai` SDK client, and is covered by mocked API contract tests',
    packagePurpose: 'OpenAI provider adapter',
    systemDependency: 'Set `OPENAI_API_KEY` for live provider runs',
    scaffold: {
      key: 'openai',
      expression: "openaiProvider({ model: process.env.FDEKIT_MODEL || 'gpt-5.5' })",
      imports: [
        { moduleName: '@fdekit/provider-openai', names: ['openaiProvider'] },
      ],
      dependencies: fdekitDependency('@fdekit/provider-openai'),
      env: [
        {
          name: 'OPENAI_API_KEY',
          description: 'OpenAI API key for live provider runs',
        },
      ],
    },
  },
  {
    kind: 'provider',
    id: 'anthropic',
    displayName: 'Anthropic',
    packageName: '@fdekit/provider-anthropic',
    configFactory: 'anthropicProvider()',
    runtimeAdapter: 'createAnthropicProvider()',
    maturity: 'Beta',
    supportNote: 'Uses `ANTHROPIC_API_KEY` by default, supports custom API base URLs or an injected official `@anthropic-ai/sdk` client, and is covered by mocked API contract tests',
    packagePurpose: 'Anthropic provider adapter',
    systemDependency: 'Set `ANTHROPIC_API_KEY` for live provider runs',
    scaffold: {
      key: 'anthropic',
      expression: "anthropicProvider({ model: process.env.FDEKIT_MODEL || 'claude-opus-4-8' })",
      imports: [
        { moduleName: '@fdekit/provider-anthropic', names: ['anthropicProvider'] },
      ],
      dependencies: fdekitDependency('@fdekit/provider-anthropic'),
      env: [
        {
          name: 'ANTHROPIC_API_KEY',
          description: 'Anthropic API key for live provider runs',
        },
      ],
    },
  },
  {
    kind: 'provider',
    id: 'google',
    displayName: 'Google Gemini',
    packageName: '@fdekit/provider-google',
    configFactory: 'googleProvider()',
    runtimeAdapter: 'createGoogleProvider()',
    maturity: 'Beta',
    supportNote: 'Uses `GEMINI_API_KEY` by default, supports custom API base URLs or an injected official `@google/genai` client, and is covered by mocked API contract tests',
    packagePurpose: 'Google Gemini provider adapter',
    systemDependency: 'Set `GEMINI_API_KEY` for live provider runs',
    scaffold: googleScaffold,
    aliases: [
      {
        name: 'gemini',
        scaffold: googleScaffold,
      },
    ],
  },
];
