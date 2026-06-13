import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  arrayArg,
  booleanArg,
  defineTool,
  enumArg,
  integerArg,
  objectArgs,
  stringArg,
  type InferSchemaType,
} from '../index.js';

describe('schema helpers', () => {
  it('builds JSON-schema-compatible tool args', () => {
    const schema = objectArgs({
      ticketId: stringArg({ description: 'Customer ticket id' }),
      priority: enumArg(['low', 'medium', 'high'] as const),
      notify: booleanArg({ default: false }),
    }, {
      required: ['ticketId', 'priority'] as const,
    });

    expect(schema).toEqual({
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'Customer ticket id',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
        },
        notify: {
          type: 'boolean',
          default: false,
        },
      },
      required: ['ticketId', 'priority'],
      additionalProperties: false,
    });

    expectTypeOf<InferSchemaType<typeof schema>>().toEqualTypeOf<{
      ticketId: string;
      priority: 'low' | 'medium' | 'high';
      notify?: boolean;
    }>();
  });

  it('infers defineTool args from argsSchema helpers', () => {
    const argsSchema = objectArgs({
      findings: arrayArg(objectArgs({
        filePath: stringArg(),
        line: integerArg({ minimum: 1 }),
        reason: stringArg(),
      }, {
        required: ['filePath', 'line'] as const,
      })),
    }, {
      required: ['findings'] as const,
    });

    const tool = defineTool({
      name: 'flag-any-types',
      argsSchema,
      handler(args) {
        expectTypeOf(args).toEqualTypeOf<{
          findings: Array<{
            filePath: string;
            line: number;
            reason?: string;
          }>;
        }>();

        return {
          count: args.findings.length,
        };
      },
    });

    expect(tool.argsSchema?.required).toEqual(['findings']);
  });
});
