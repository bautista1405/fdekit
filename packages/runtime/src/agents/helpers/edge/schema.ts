import { asRecord } from '@fdekit/core';

export interface SchemaValidationIssue {
  path: string;
  message: string;
}

export function validateToolArgsSchema(schema: unknown, args: unknown): SchemaValidationIssue[] {
  const issues = validateSchemaValue(schema, args, '$');

  if (issues.length > 0) {
    return issues;
  }

  const record = asRecord(schema);
  return record.type === 'object'
    ? []
    : [{ path: '$', message: 'Tool argsSchema must be an object schema' }];
}

function validateSchemaValue(schema: unknown, value: unknown, path: string): SchemaValidationIssue[] {
  const record = asRecord(schema);
  const expectedTypes = schemaTypes(record.type);
  const issues: SchemaValidationIssue[] = [];

  if (Object.keys(record).length === 0) {
    return [{ path, message: 'Schema must be an object' }];
  }

  if (expectedTypes.length > 0 && !expectedTypes.some((type) => matchesJsonType(value, type))) {
    return [{
      path,
      message: `Expected ${expectedTypes.join(' or ')}, received ${jsonTypeOf(value)}`,
    }];
  }

  if (Array.isArray(record.enum) && !record.enum.some((candidate) => jsonValueEquals(candidate, value))) {
    issues.push({ path, message: `Value must be one of: ${record.enum.map(String).join(', ')}` });
  }

  if (expectedTypes.includes('object') || (!record.type && record.properties)) {
    issues.push(...validateObjectSchema(record, value, path));
  }

  if (expectedTypes.includes('array')) {
    issues.push(...validateArraySchema(record, value, path));
  }

  if (expectedTypes.includes('string')) {
    issues.push(...validateStringSchema(record, value, path));
  }

  if (expectedTypes.includes('number') || expectedTypes.includes('integer')) {
    issues.push(...validateNumberSchema(record, value, path));
  }

  return issues;
}

function validateObjectSchema(
  schema: Record<string, unknown>,
  value: unknown,
  path: string,
): SchemaValidationIssue[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [{ path, message: `Expected object, received ${jsonTypeOf(value)}` }];
  }

  const valueRecord = value as Record<string, unknown>;
  const properties = asRecord(schema.properties);
  const required = Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === 'string') : [];
  const issues = required
    .filter((key) => valueRecord[key] === undefined)
    .map((key) => ({ path: childPath(path, key), message: 'Required property is missing' }));

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(valueRecord)) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) {
        issues.push({ path: childPath(path, key), message: 'Additional properties are not allowed' });
      }
    }
  }

  for (const [key, propertySchema] of Object.entries(properties)) {
    if (valueRecord[key] !== undefined) {
      issues.push(...validateSchemaValue(propertySchema, valueRecord[key], childPath(path, key)));
    }
  }

  return issues;
}

function validateArraySchema(
  schema: Record<string, unknown>,
  value: unknown,
  path: string,
): SchemaValidationIssue[] {
  if (!Array.isArray(value)) {
    return [{ path, message: `Expected array, received ${jsonTypeOf(value)}` }];
  }

  const issues: SchemaValidationIssue[] = [];
  const minItems = numberOption(schema.minItems);
  const maxItems = numberOption(schema.maxItems);

  if (minItems !== undefined && value.length < minItems) {
    issues.push({ path, message: `Expected at least ${minItems} item(s)` });
  }

  if (maxItems !== undefined && value.length > maxItems) {
    issues.push({ path, message: `Expected at most ${maxItems} item(s)` });
  }

  if (schema.items) {
    value.forEach((item, index) => {
      issues.push(...validateSchemaValue(schema.items, item, childPath(path, String(index))));
    });
  }

  return issues;
}

function validateStringSchema(
  schema: Record<string, unknown>,
  value: unknown,
  path: string,
): SchemaValidationIssue[] {
  if (typeof value !== 'string') {
    return [];
  }

  const issues: SchemaValidationIssue[] = [];
  const minLength = numberOption(schema.minLength);
  const maxLength = numberOption(schema.maxLength);

  if (minLength !== undefined && value.length < minLength) {
    issues.push({ path, message: `Expected string length >= ${minLength}` });
  }

  if (maxLength !== undefined && value.length > maxLength) {
    issues.push({ path, message: `Expected string length <= ${maxLength}` });
  }

  if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) {
    issues.push({ path, message: `String does not match pattern ${schema.pattern}` });
  }

  return issues;
}

function validateNumberSchema(
  schema: Record<string, unknown>,
  value: unknown,
  path: string,
): SchemaValidationIssue[] {
  if (typeof value !== 'number') {
    return [];
  }

  const issues: SchemaValidationIssue[] = [];
  const minimum = numberOption(schema.minimum);
  const maximum = numberOption(schema.maximum);

  if (minimum !== undefined && value < minimum) {
    issues.push({ path, message: `Expected number >= ${minimum}` });
  }

  if (maximum !== undefined && value > maximum) {
    issues.push({ path, message: `Expected number <= ${maximum}` });
  }

  if (schemaTypes(schema.type).includes('integer') && !Number.isInteger(value)) {
    issues.push({ path, message: 'Expected integer' });
  }

  return issues;
}

function schemaTypes(type: unknown): string[] {
  if (Array.isArray(type)) {
    return type.filter((item): item is string => typeof item === 'string');
  }

  return typeof type === 'string' ? [type] : [];
}

function matchesJsonType(value: unknown, type: string): boolean {
  return type === 'integer'
    ? typeof value === 'number' && Number.isInteger(value)
    : jsonTypeOf(value) === type;
}

function jsonTypeOf(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
}

function childPath(path: string, key: string): string {
  return path === '$' ? `$.${key}` : `${path}.${key}`;
}

function jsonValueEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function numberOption(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
