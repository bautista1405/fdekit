import type {
  HttpResilienceClient,
  HttpResilienceOptions,
  ProviderPlanContext,
  ProviderStep,
  ProviderToolCallStep,
} from '../types/index.js';
import { asRecord, getString, readProcessEnv } from '../helpers/index.js';

export interface ProviderPlannerToolMetadata {
  name: string;
  description?: string;
  argsSchema?: unknown;
  scopes?: string[];
  environments?: string[];
  category?: string;
  tags?: string[];
}

export interface ProviderPlannerInputPayload {
  deployment: string;
  agent: string;
  input: Record<string, unknown>;
  stepIndex: number;
  maxSteps: number;
  availableTools: ProviderPlannerToolMetadata[];
  toolResults: ProviderPlanContext['toolResults'];
}

export function buildProviderPlannerInstructions(context: ProviderPlanContext): string {
  return [
    'You are the FDEKit runtime planner for a field-deployed AI agent',
    'Decide the next step for this agent loop',
    'Return only strict JSON with one of these shapes:',
    '{"type":"tool_call","toolName":"tool.name","args":{},"reason":"short reason"}',
    '{"type":"final","message":"final answer for the user"}',
    'Use only available tool names; prefer a final answer when enough tool results are present',
    'For tool_call steps, args must match the selected tool argsSchema and include every required property',
    'Use the input and previous toolResults to fill tool arguments; never send empty args unless the tool schema has no required fields',
    '',
    'Agent instructions:',
    context.instructions,
  ].join('\n');
}

export function buildProviderPlannerInput(context: ProviderPlanContext): string {
  return JSON.stringify(buildProviderPlannerInputPayload(context), null, 2);
}

export function buildProviderPlannerInputPayload(context: ProviderPlanContext): ProviderPlannerInputPayload {
  return {
    deployment: context.deployment.name,
    agent: context.agentName,
    input: context.input,
    stepIndex: context.stepIndex,
    maxSteps: context.maxSteps,
    availableTools: collectProviderToolMetadata(context),
    toolResults: context.toolResults,
  };
}

export function collectProviderToolMetadata(context: ProviderPlanContext): ProviderPlannerToolMetadata[] {
  const connectorTools = Object.values(context.deployment.connectors ?? {})
    .flatMap((connector) => connector.tools ?? []);
  const agentTools = context.agent.tools ?? [];

  return [...connectorTools, ...agentTools].map((tool) => ({
    name: tool.name,
    description: tool.description,
    argsSchema: tool.argsSchema,
    scopes: tool.scopes,
    environments: tool.environments,
    category: tool.category,
    tags: tool.tags,
  }));
}

export function parseProviderPlannerStep(text: string, providerName = 'Provider'): ProviderStep {
  const value = JSON.parse(extractProviderJson(text, providerName)) as unknown;
  const record = asRecord(value);

  if (record.type === 'final') {
    const message = getString(record.message);

    if (!message) {
      throw new Error(`${providerName} final step is missing a message`);
    }

    return { type: 'final', message };
  }

  if (record.type === 'tool_call') {
    const toolName = getString(record.toolName);

    if (!toolName) {
      throw new Error(`${providerName} tool call step is missing toolName`);
    }

    return {
      type: 'tool_call',
      toolName,
      args: asRecord(record.args),
      reason: getString(record.reason),
    } satisfies ProviderToolCallStep;
  }

  throw new Error(`${providerName} provider returned unsupported step type: ${String(record.type)}`);
}

export function extractProviderJson(text: string, providerName = 'Provider'): string {
  const trimmed = text.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const match = trimmed.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error(`${providerName} response was not JSON: ${text}`);
  }

  return match[0];
}

export function getHttpResilienceOptions(value: unknown): HttpResilienceOptions | undefined {
  return value && typeof value === 'object' ? (value as HttpResilienceOptions) : undefined;
}

export interface ProviderJsonRequestOptions {
  providerName: string;
  resilience: HttpResilienceClient;
  fetch?: typeof globalThis.fetch;
  apiBaseUrl: string;
  path: string;
  init: RequestInit;
  errorPrefix: string;
  requestFailureMessage?: (apiBaseUrl: string, errorMessage: string) => string;
}

export async function requestProviderJson(options: ProviderJsonRequestOptions): Promise<unknown> {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error(`No fetch implementation is available for ${options.providerName} provider`);
  }

  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl);
  let response: Response;

  try {
    response = await options.resilience.request(fetchImpl, `${apiBaseUrl}${options.path}`, options.init);
  } catch (err) {
    if (!options.requestFailureMessage) {
      throw err;
    }

    const message = err instanceof Error ? err.message : String(err);
    throw new Error(options.requestFailureMessage(apiBaseUrl, message));
  }

  const value = await response.json().catch(() => ({})) as unknown;

  if (!response.ok) {
    throw new Error(`${options.errorPrefix}: ${providerErrorMessage(value, response)}`);
  }

  return value;
}

export function requireProviderApiKey(
  providerName: string,
  apiKeyEnv: string,
  env: Record<string, string | undefined> = readProcessEnv(),
): string {
  const token = env[apiKeyEnv];

  if (!token) {
    throw new Error(`Missing ${providerName} API key; set ${apiKeyEnv} or use the mock provider`);
  }

  return token;
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

export function compactRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

export function providerErrorMessage(value: unknown, response: Response): string {
  const error = asRecord(asRecord(value).error);
  return getString(error.message) ?? getString(asRecord(value).message) ?? `${response.status} ${response.statusText}`;
}
