import { getString, type AgentProvider, type MaybePromise, type ProviderPlanContext, type ProviderStep } from '@fdekit/core';

export type MockPlanner = (context: ProviderPlanContext) => MaybePromise<ProviderStep>;

export interface MockProviderOptions {
  name?: string;
  planner?: MockPlanner;
  message?: string;
}

export function createMockProvider(options: MockProviderOptions = {}): AgentProvider {
  const planner = options.planner ?? createDefaultMockPlanner(options.message);

  return {
    name: options.name ?? 'mock',
    planNextStep(context) {
      return planner(context);
    },
  };
}

function createDefaultMockPlanner(message?: string): MockPlanner {
  return (context) => ({
    type: 'final',
    message: message ?? defaultMessage(context),
  });
}

function defaultMessage(context: ProviderPlanContext): string {
  const task = getString(context.input.task) ?? getString(context.input.prompt) ?? getString(context.input.message);

  return task
    ? `Mock provider completed: ${task}`
    : 'Mock provider completed; configure provider options.planner for deterministic tool-call flows';
}
