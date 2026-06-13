import type { DeploymentEnvironmentDefinition } from './environment.js';
import type { EnvironmentName, MaybePromise } from './shared.js';

export interface ToolCallContext {
  deploymentName?: string;
  agentName?: string;
  environment?: EnvironmentName;
  runtimeEnvironment?: DeploymentEnvironmentDefinition;
  toolName?: string;
  toolScopes?: string[];
  toolAllowedEnvironments?: EnvironmentName[];
  toolCategory?: string;
  toolTags?: string[];
  toolCallCount?: number;
  costUsd?: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ToolDefinition<Args = unknown, Result = unknown> {
  name: string;
  description?: string;
  scopes?: string[];
  environments?: EnvironmentName[];
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  argsSchema?: unknown;
  handler: (args: Args, context: ToolCallContext) => MaybePromise<Result>;
}

export type AnyToolDefinition = ToolDefinition<any, any>;

export type ToolDefinitionWithSchema<Args, Result = unknown> = Omit<ToolDefinition<Args, Result>, 'argsSchema'> & {
  argsSchema: ToolArgsSchema<Args>;
};

export type JsonSchemaTypeName = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
export type JsonSchemaValue = string | number | boolean | null | JsonSchemaValue[] | { [key: string]: JsonSchemaValue };

export interface JsonSchema<T = unknown> {
  type?: JsonSchemaTypeName | JsonSchemaTypeName[];
  description?: string;
  default?: JsonSchemaValue;
  enum?: readonly JsonSchemaValue[];
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  readonly __fdekitType?: T;
}

export type ToolArgsSchema<Args = Record<string, unknown>> = JsonSchema<Args> & {
  type: 'object';
  properties: Record<string, JsonSchema>;
};

export type InferSchemaType<Schema> = Schema extends JsonSchema<infer Value> ? Value : unknown;

export interface StringArgOptions {
  description?: string;
  default?: string;
  enum?: readonly string[];
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface NumberArgOptions {
  description?: string;
  default?: number;
  minimum?: number;
  maximum?: number;
}

export interface BooleanArgOptions {
  description?: string;
  default?: boolean;
}

export interface ArrayArgOptions {
  description?: string;
  minItems?: number;
  maxItems?: number;
}

export interface ObjectArgsOptions<Required extends readonly string[] = readonly string[]> {
  description?: string;
  required?: Required;
  additionalProperties?: boolean | JsonSchema;
}
