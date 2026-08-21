import { randomUUID } from 'node:crypto';
import type { ExecutionTool, ExecutionToolOptions } from './types.js';

export function defineExecutionTool<Args = unknown>(
  options: ExecutionToolOptions<Args>,
): ExecutionTool<Args> {
  if (!options.name.trim()) throw new Error('Execution tool name is required');
  const leaseTtlMs = options.leaseTtlMs ?? 60_000;
  if (!Number.isInteger(leaseTtlMs) || leaseTtlMs <= 0) {
    throw new Error('Execution tool leaseTtlMs must be a positive integer');
  }

  return {
    name: options.name,
    ...(options.description ? { description: options.description } : {}),
    ...(options.argsSchema === undefined ? {} : { argsSchema: options.argsSchema }),
    ...(options.scopes ? { scopes: options.scopes } : {}),
    ...(options.category ? { category: options.category } : {}),
    ...(options.tags ? { tags: options.tags } : {}),
    metadata: {
      executionBackend: options.backend.name,
      isolationRequirements: options.requirements ?? {},
    },
    async handler(args, context) {
      const lease = await options.backend.acquire({
        leaseId: `tool-${randomUUID()}`,
        ttlMs: leaseTtlMs,
        files: options.files?.(args, context),
        requirements: options.requirements,
        metadata: {
          deploymentName: context.deploymentName,
          agentName: context.agentName,
          toolName: options.name,
        },
      });
      try {
        const result = await lease.execute(options.command(args, context));
        if (result.status !== 'completed' && !options.allowFailure) {
          throw new Error(
            `Execution backend ${options.backend.name} returned ${result.status}`
            + (result.stderr ? `: ${result.stderr}` : ''),
          );
        }
        return result;
      } finally {
        await lease.release();
      }
    },
  };
}
