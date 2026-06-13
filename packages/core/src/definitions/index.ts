import { asRecord, getString } from '../helpers/index.js';
import type {
  AgentConfig,
  ConnectorDefinition,
  DataLayersDefinition,
  DeploymentEnvironmentDefinition,
  DeploymentDefinition,
  EnvironmentEndpointRef,
  EvalDefinition,
  GovernanceDefinition,
  HarnessDefinition,
  HarnessDefinitionInput,
  OutcomeMetricDefinition,
  PolicyDefinition,
  RecipeDefinition,
  RolloutDefinition,
  ToolDefinition,
  ToolDefinitionWithSchema,
  WorkflowDefinition,
} from '../types/index.js';

//define your deployment strategy
export function defineDeployment<T extends DeploymentDefinition>(definition: T): T {
  return definition;
}

//define a local or remote customer-like runtime environment
export function defineEnvironment<T extends DeploymentEnvironmentDefinition>(environment: T): T {
  return environment;
}

const environmentEndpointScheme = 'environment://';

//reference an endpoint exported by the deployment's runtime environment
export function environmentEndpoint(name: string): EnvironmentEndpointRef {
  return { $environmentEndpoint: name };
}

export function isEnvironmentEndpointRef(value: unknown): value is EnvironmentEndpointRef {
  return typeof asRecord(value).$environmentEndpoint === 'string';
}

export function environmentEndpointConfigValue(ref: EnvironmentEndpointRef): string {
  return `${environmentEndpointScheme}${ref.$environmentEndpoint}`;
}

export function parseEnvironmentEndpointConfigValue(value: string): string | undefined {
  return value.startsWith(environmentEndpointScheme)
    ? value.slice(environmentEndpointScheme.length)
    : undefined;
}

export function resolveEnvironmentEndpoint(
  ref: EnvironmentEndpointRef | string,
  environment: DeploymentEnvironmentDefinition | undefined,
): string | undefined {
  if (!environment) {
    return undefined;
  }

  const name = typeof ref === 'string' ? ref : ref.$environmentEndpoint;
  const endpoint = (environment.evidence?.endpoints ?? []).find((candidate) => candidate.name === name);

  if (endpoint?.url) {
    return endpoint.url;
  }

  // Conventional fallback for environments that declare the customer API in config only.
  if (name === 'customer-api') {
    return getString(asRecord(asRecord(environment.config).customerApi).url);
  }

  return undefined;
}

//define your agent config
export function defineAgent<T extends AgentConfig>(config: T): T {
  return config;
}

//define your tools
export function defineTool<Args, Result = unknown>(
  tool: ToolDefinitionWithSchema<Args, Result>,
): ToolDefinition<Args, Result>;
export function defineTool<Args = unknown, Result = unknown>(
  tool: ToolDefinition<Args, Result>,
): ToolDefinition<Args, Result>;
export function defineTool<Args = unknown, Result = unknown>(
  tool: ToolDefinition<Args, Result>,
): ToolDefinition<Args, Result> {
  return tool;
}

//define connectors like Jira, Linear, Github, etc, etc
export function defineConnector<T extends ConnectorDefinition>(connector: T): T {
  return connector;
}

//define governance for agent loops, like budget, environments, permissions
export function defineGovernance<T extends GovernanceDefinition>(governance: T): T {
  return governance;
}

//define the operational harness that maps phases to existing tools, policies, evals, and artifacts
export function defineHarness(harness: HarnessDefinitionInput): HarnessDefinition {
  return {
    ...harness,
    toolRefs: normalizeHarnessRefs(harness.toolRefs),
    policyRefs: normalizeHarnessRefs(harness.policyRefs),
    evalRefs: normalizeHarnessRefs(harness.evalRefs),
    phases: harness.phases.map((phase) => ({
      ...phase,
      toolRefs: normalizeHarnessRefs(phase.toolRefs),
      optionalToolRefs: normalizeHarnessRefs(phase.optionalToolRefs),
      policyRefs: normalizeHarnessRefs(phase.policyRefs),
      evalRefs: normalizeHarnessRefs(phase.evalRefs),
    })),
    review: harness.review
      ? {
        ...harness.review,
        evalRefs: normalizeHarnessRefs(harness.review.evalRefs),
      }
      : undefined,
    steer: harness.steer
      ? {
        ...harness.steer,
        triggerRefs: normalizeHarnessRefs(harness.steer.triggerRefs),
      }
      : undefined,
  };
}

function normalizeHarnessRefs(refs: Array<string | { name: string }> | undefined): string[] | undefined {
  if (!refs) {
    return undefined;
  }

  return refs.map((ref) => typeof ref === 'string' ? ref : ref.name);
}

//define the business workflow an agent deployment is meant to reshape
export function defineWorkflow<T extends WorkflowDefinition>(workflow: T): T {
  return workflow;
}

//define measurable outcomes for workflow impact
export function defineOutcomeMetric<T extends OutcomeMetricDefinition>(metric: T): T {
  return metric;
}

//define the separated data layers used by a deployment
export function defineDataLayers<T extends DataLayersDefinition>(layers: T): T {
  return layers;
}

//define rollout stage and next operational step
export function defineRollout<T extends RolloutDefinition>(rollout: T): T {
  return rollout;
}

//define policies to be run before and after tool calls
export function definePolicy<T extends PolicyDefinition>(policy: T): T {
  return policy;
}

//define evals and assertions
export function defineEval<T extends EvalDefinition>(definition: T): T {
  return definition;
}

//define and create recipes, which can be reusable
export function defineRecipe<T extends RecipeDefinition>(recipe: T): T {
  return recipe;
}
