import type {
  ArrayArgOptions,
  BooleanArgOptions,
  InferSchemaType,
  JsonSchema,
  JsonSchemaTypeName,
  JsonSchemaValue,
  NumberArgOptions,
  ObjectArgsOptions,
  StringArgOptions,
  ToolArgsSchema,
} from '../types/index.js';

type Simplify<T> = { [Key in keyof T]: T[Key] } & {};
type RequiredKeys<Shape, Required extends readonly PropertyKey[]> = Extract<Required[number], keyof Shape>;
type ObjectSchemaValue<
  Shape extends Record<string, JsonSchema>,
  Required extends readonly (keyof Shape & string)[],
> = Simplify<{
  [Key in RequiredKeys<Shape, Required>]: InferSchemaType<Shape[Key]>;
} & {
  [Key in Exclude<keyof Shape, RequiredKeys<Shape, Required>>]?: InferSchemaType<Shape[Key]>;
}>;

export function defineArgsSchema<Args extends Record<string, unknown>>(
  schema: ToolArgsSchema<Args>,
): ToolArgsSchema<Args> {
  return schema;
}

export function stringArg(options: StringArgOptions = {}): JsonSchema<string> {
  return compactSchema({
    type: 'string',
    description: options.description,
    default: options.default,
    enum: options.enum,
    format: options.format,
    pattern: options.pattern,
    minLength: options.minLength,
    maxLength: options.maxLength,
  });
}

export function numberArg(options: NumberArgOptions = {}): JsonSchema<number> {
  return compactSchema({
    type: 'number',
    description: options.description,
    default: options.default,
    minimum: options.minimum,
    maximum: options.maximum,
  });
}

export function integerArg(options: NumberArgOptions = {}): JsonSchema<number> {
  return compactSchema({
    type: 'integer',
    description: options.description,
    default: options.default,
    minimum: options.minimum,
    maximum: options.maximum,
  });
}

export function booleanArg(options: BooleanArgOptions = {}): JsonSchema<boolean> {
  return compactSchema({
    type: 'boolean',
    description: options.description,
    default: options.default,
  });
}

export function enumArg<const Values extends readonly [JsonSchemaValue, ...JsonSchemaValue[]]>(
  values: Values,
  options: { description?: string; default?: Values[number] } = {},
): JsonSchema<Values[number]> {
  return compactSchema({
    type: inferEnumType(values),
    description: options.description,
    default: options.default,
    enum: values,
  });
}

export function arrayArg<ItemSchema extends JsonSchema>(
  items: ItemSchema,
  options: ArrayArgOptions = {},
): JsonSchema<Array<InferSchemaType<ItemSchema>>> {
  return compactSchema({
    type: 'array',
    description: options.description,
    items,
    minItems: options.minItems,
    maxItems: options.maxItems,
  });
}

export function objectArgs<const Shape extends Record<string, JsonSchema>>(
  properties: Shape,
): ToolArgsSchema<Simplify<{ [Key in keyof Shape]?: InferSchemaType<Shape[Key]> }>>;
export function objectArgs<
  const Shape extends Record<string, JsonSchema>,
  const Required extends readonly (keyof Shape & string)[],
>(
  properties: Shape,
  options: ObjectArgsOptions<Required>,
): ToolArgsSchema<ObjectSchemaValue<Shape, Required>>;
export function objectArgs(
  properties: Record<string, JsonSchema>,
  options: ObjectArgsOptions = {},
): ToolArgsSchema {
  return compactSchema({
    type: 'object',
    description: options.description,
    properties,
    required: options.required,
    additionalProperties: options.additionalProperties ?? false,
  }) as ToolArgsSchema;
}

function compactSchema<T extends JsonSchema>(schema: T): T {
  return Object.fromEntries(
    Object.entries(schema).filter(([, value]) => value !== undefined),
  ) as T;
}

function inferEnumType(values: readonly JsonSchemaValue[]): JsonSchemaTypeName | JsonSchemaTypeName[] {
  const types = [...new Set(values.map(jsonSchemaTypeOf))];
  return types.length === 1 ? types[0] : types;
}

function jsonSchemaTypeOf(value: JsonSchemaValue): JsonSchemaTypeName {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return 'integer';
  }

  return typeof value as JsonSchemaTypeName;
}
