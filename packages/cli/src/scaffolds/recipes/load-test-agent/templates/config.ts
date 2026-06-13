import {
  renderConfigTemplate,
  renderDeploymentHeader,
  renderEvalSetup,
  renderImportBlock,
  renderRecipeModulePath,
  renderRuntimeSettings,
} from '../../config-renderers.js';
import type { RecipeContext } from '../../../registry.js';

export function renderLoadTestConfig(ctx: RecipeContext): string {
  return renderConfigTemplate([
    importsBlock(ctx),
    mockPlannerSetup(),
    runtimeSettings(),
    evalSetup(),
    deploymentBlock(ctx.projectName),
  ]);
}

function importsBlock(ctx: RecipeContext): string {
  return `${renderImportBlock({
    core: [
      'defineAgent',
      'defineDataLayers',
      'defineDeployment',
      'defineEval',
      'defineGovernance',
      'defineHarness',
      'defineOutcomeMetric',
      'defineRollout',
      'defineWorkflow',
      'expectedFinalAnswer',
      'expectedToolCall',
      'limitCost',
      'limitToolUse',
      'maxLatency',
      'noPolicyViolation',
      'numberFromEnv',
      'pick',
      'type ProviderConfig',
    ],
    packages: [
      { moduleName: '@fdekit/connector-k6', names: ['k6Connector'] },
    ],
  })}import { createLoadTestMockPlanner } from '${renderRecipeModulePath(ctx, 'mock-planner.mjs')}';

`;
}

function mockPlannerSetup(): string {
  return `const loadTestMockPlanner = createLoadTestMockPlanner();

`;
}

function runtimeSettings(): string {
  return `${renderRuntimeSettings({
    mockModel: 'load-test-local',
    beforeSettings: "const targetUrl = process.env.LOAD_TEST_TARGET_URL ?? 'http://localhost:8000';\n",
    settings: [
      {
        name: 'targetUrl',
        type: 'string',
        expression: 'targetUrl',
      },
    ],
  })}
const providerConfigs: Record<ProviderChoice, ProviderConfig> = {
  mock: {
    name: 'mock',
    model: defaultModels.mock,
    options: {
      planner: loadTestMockPlanner,
    },
  },
  localOllama: {
    name: 'localOllama',
    model: settings.model,
    options: {
      apiBaseUrl: process.env.OLLAMA_BASE_URL,
    },
    env: [
      { name: 'OLLAMA_BASE_URL', required: false, description: 'Optional Ollama server URL' },
    ],
  },
  openai: {
    name: 'openai',
    model: settings.model,
    apiKeyEnv: 'OPENAI_API_KEY',
    env: [{ name: 'OPENAI_API_KEY', required: true, description: 'OpenAI API key' }],
  },
  anthropic: {
    name: 'anthropic',
    model: settings.model,
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    env: [{ name: 'ANTHROPIC_API_KEY', required: true, description: 'Anthropic API key' }],
  },
  google: {
    name: 'google',
    model: settings.model,
    apiKeyEnv: 'GEMINI_API_KEY',
    env: [{ name: 'GEMINI_API_KEY', required: true, description: 'Google Gemini API key' }],
  },
};
`;
}

function evalSetup(): string {
  return renderEvalSetup({
    toolLimit: {
      constName: 'loadTestToolLimit',
      expression: "limitToolUse({ tools: ['loadtest.run'], maxCalls: 1 })",
    },
    policies: [
      {
        constName: 'loadTestCostLimit',
        expression: 'limitCost({ maxUsd: 0.10 })',
      },
    ],
    evalConst: 'loadTestSmokeEval',
    name: 'load-test-smoke',
    agent: 'loadTestAgent',
    dataset: './evals/load-test-agent.json',
    maxSteps: 4,
    assertions: [
      "expectedToolCall('loadtest.run')",
      "expectedFinalAnswer('Load test passed')",
      'noPolicyViolation()',
      'maxLatency(10000)',
    ],
  });
}

function deploymentBlock(projectName: string): string {
  return `${renderDeploymentHeader(projectName, 'load-test')}  // Runtime uses providers, connectors, agents, governance, evals, harness, and artifacts.
  // Workflow/outcomeMetrics/dataLayers/rollout are field-method narrative for reports and recipe handoff.
  environment: 'local',
  providers: {
    ...providerConfigs,
  },
  connectors: {
    k6: k6Connector({
      mode: process.env.FDEKIT_LOAD_TEST_MODE === 'k6' ? 'k6' : 'local',
      targetUrl,
      scriptPath: process.env.K6_SCRIPT ?? './load-tests/customer-api-smoke.js',
      k6Command: process.env.K6_BINARY ?? 'k6',
      defaultVus: numberFromEnv('K6_DEFAULT_VUS', 5),
      defaultDuration: process.env.K6_DEFAULT_DURATION ?? '10s',
      maxVus: numberFromEnv('K6_MAX_VUS', 50),
      maxDurationSeconds: numberFromEnv('K6_MAX_DURATION_SECONDS', 300),
      p95ThresholdMs: numberFromEnv('K6_P95_THRESHOLD_MS', 500),
      errorRateThreshold: numberFromEnv('K6_ERROR_RATE_THRESHOLD', 0.01),
    }),
  },
  workflow: defineWorkflow({
    name: 'Customer API load-test readiness',
    owner: 'platform-engineering',
    currentState: {
      summary: 'Engineers manually run smoke or k6 scripts and paste results into readiness notes',
      handoffs: ['forward-deployed-engineer', 'platform-engineering', 'customer-owner'],
      baseline: {
        cycleTime: '30m manual smoke test and report',
        manualSteps: 5,
      },
    },
    targetState: {
      summary: 'The agent runs a governed load test, captures threshold evidence, and produces report/dashboard artifacts',
      target: '<5m from target API to readiness evidence',
      evidence: ['p95 latency', 'error rate', 'checks rate', 'threshold status', 'trace/audit record'],
    },
    scorecard: {
      volume: 'medium',
      manualEffort: 'medium',
      fragmentedSystems: ['customer-api', 'local environment', 'k6 script', 'dashboard exports'],
      repeatableDecisions: 'high',
      measurablePain: ['p95-latency', 'error-rate', 'readiness-evidence-cycle-time'],
      riskBoundary: 'Stress and spike tests should remain capped and approval-gated in shared customer environments',
    },
  }),
  outcomeMetrics: [
    defineOutcomeMetric({
      name: 'p95-latency',
      baseline: 'unknown until first run',
      target: '<500ms in smoke profile',
    }),
    defineOutcomeMetric({
      name: 'error-rate',
      baseline: 'unknown until first run',
      target: '<1% request failures',
    }),
  ],
  dataLayers: defineDataLayers({
    systemOfRecord: ['customer API', 'load-test script'],
    businessRules: ['./agents/load-test-agent.md', 'k6 thresholds', 'governance policies'],
    rawIntake: ['scenario', 'targetUrl', 'vus', 'duration'],
    feedback: ['.fdekit/approvals', '.fdekit/audit', '.fdekit/evals', 'load-tests/.results'],
  }),
  rollout: defineRollout({
    stage: 'local',
    stages: ['local', 'sandbox', 'customer-sample', 'shadow', 'approved-write', 'production-allowlist'],
    next: 'Run deterministic local mode first, then install k6 and point LOAD_TEST_TARGET_URL at a customer-owned API',
  }),
  harness: defineHarness({
    name: 'load-test-safety-harness',
    description: 'Bounded target validation, load-test execution, and threshold review for customer APIs',
    maxSteps: 5,
    phases: [
      {
        name: 'target-check',
        description: 'Confirm the intended target and scenario before running load',
        artifactRefs: ['trace', 'target-summary'],
        maxSteps: 1,
      },
      {
        name: 'bounded-run',
        description: 'Run the load test through capped k6/local settings',
        toolRefs: ['loadtest.run'],
        policyRefs: ['limit-tool-scopes', 'restrict-environments', loadTestToolLimit, loadTestCostLimit],
        artifactRefs: ['load-test-result', 'audit'],
        maxSteps: 2,
      },
      {
        name: 'threshold-review',
        description: 'Compare p95, error rate, and checks against the configured readiness thresholds',
        policyRefs: [loadTestCostLimit],
        evalRefs: [loadTestSmokeEval],
        artifactRefs: ['threshold-summary'],
        maxSteps: 1,
      },
      {
        name: 'handoff',
        description: 'Run evals and generate dashboard/report artifacts',
        evalRefs: [loadTestSmokeEval],
        artifactRefs: ['eval', 'report', 'dashboard'],
        maxSteps: 1,
      },
    ],
    toolRefs: ['loadtest.run'],
    policyRefs: ['limit-tool-scopes', 'restrict-environments', 'limit-cost', loadTestToolLimit, loadTestCostLimit],
    evalRefs: [loadTestSmokeEval],
    artifactRefs: ['trace', 'load-test-result', 'audit', 'eval', 'report', 'dashboard'],
    review: {
      evalRefs: [loadTestSmokeEval],
      artifactRefs: ['report', 'dashboard'],
    },
    steer: {
      enabled: true,
      maxAttempts: 1,
      triggerRefs: [loadTestSmokeEval, loadTestCostLimit],
    },
  }),
  metadata: {
    businessImpact: {
      workflow: 'Customer API load-test readiness',
      estimatedMinutesSaved: 25,
    },
  },
  governance: defineGovernance({
    audit: { enabled: true, redactSensitive: true },
    permissions: {
      allowedScopes: ['loadtest:run'],
      requireScopes: true,
    },
    environments: {
      allowed: ['local', 'development', 'staging'],
      tools: ['loadtest.run'],
    },
    budgets: [
      { scope: 'agent:loadTestAgent', maxUsd: 0.10 },
    ],
  }),
  policies: [
    loadTestToolLimit,
    loadTestCostLimit,
  ],
  agents: {
    loadTestAgent: defineAgent({
      provider,
      instructions: './agents/load-test-agent.md',
    }),
  },
  evals: [
    loadTestSmokeEval,
  ],
});
`;
}
