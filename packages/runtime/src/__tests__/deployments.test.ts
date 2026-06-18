import { describe, expect, it } from 'vitest';
import {
  defineAgent,
  defineConnector,
  defineDataLayers,
  defineDeployment,
  defineGovernance,
  defineHarness,
  defineOutcomeMetric,
  defineRollout,
  defineTool,
  defineWorkflow,
  expectedToolCall,
  judgeRubric,
  type S3ArtifactClient,
} from '@fdekit/core';
import {
  compileDeployment,
  createDeploymentSnapshot,
  diffDeploymentSnapshots,
  validateDeployment,
} from '../deployments/index.js';

const s3ArtifactClient: S3ArtifactClient = {
  async putObject() {},
  async getObject() {
    return {};
  },
  async listObjectsV2() {
    return {};
  },
};

describe('deployment validation and diffing', () => {
  it('compiles a deployment into an inspectable execution plan', () => {
    const deployment = defineDeployment({
      name: 'compiled-support',
      environment: 'staging',
      providers: {
        openai: {
          name: 'openai',
          model: 'gpt-test',
          apiKeyEnv: 'OPENAI_API_KEY',
          env: [
            {
              name: 'OPENAI_API_KEY',
              required: true,
              description: 'OpenAI key',
            },
          ],
          runtime: () => ({
            name: 'openai',
            planNextStep() {
              return { type: 'final', message: 'ok' };
            },
          }),
        },
      },
      connectors: {
        github: defineConnector({
          name: 'github',
          env: [
            {
              name: 'GITHUB_TOKEN',
              required: true,
              description: 'GitHub token',
            },
          ],
          tools: [
            defineTool({
              name: 'issue.create',
              scopes: ['issues:write'],
              environments: ['staging'],
              category: 'issue',
              tags: ['action', 'escalation', 'issue'],
              argsSchema: { type: 'object', properties: {} },
              handler() {
                return { ok: true };
              },
            }),
          ],
        }),
      },
      governance: defineGovernance({
        dataProtection: {
          redactSecrets: true,
        },
        permissions: {
          allowedScopes: ['issues:write', 'notes:write'],
        },
        budgets: [
          { maxUsd: 0.25 },
        ],
      }),
      policies: [
        { name: 'deployment-policy' },
      ],
      agents: {
        triage: defineAgent({
          provider: 'openai',
          instructions: './agents/triage.md',
          tools: [
            defineTool({
              name: 'agent.note',
              scopes: ['notes:write'],
              environments: ['staging'],
              category: 'note',
              tags: ['action', 'note'],
              argsSchema: { type: 'object', properties: {} },
              handler() {
                return { ok: true };
              },
            }),
          ],
          policies: [
            { name: 'agent-policy' },
          ],
        }),
      },
      evals: [
        {
          name: 'triage-eval',
          agent: 'triage',
          cases: [
            { name: 'case', input: {} },
          ],
          assertions: [expectedToolCall('issue.create')],
        },
      ],
      harness: defineHarness({
        name: 'triage-harness',
        toolRefs: ['issue.create'],
        policyRefs: ['limit-cost'],
        evalRefs: ['triage-eval'],
        artifactRefs: ['trace'],
        phases: [
          {
            name: 'act',
            toolRefs: ['issue.create', 'missing.tool'],
            policyRefs: ['deployment-policy'],
            evalRefs: ['triage-eval'],
            artifactRefs: ['audit'],
          },
        ],
        review: {
          evalRefs: ['triage-eval'],
          artifactRefs: ['report'],
        },
        steer: {
          enabled: true,
          triggerRefs: ['limit-cost', 'triage-eval'],
        },
      }),
    });

    const plan = compileDeployment(deployment, {
      createdAt: '2026-06-06T00:00:00.000Z',
      projectDir: '/tmp/fdekit-compiled',
    });

    expect(plan.valid).toBe(true);
    expect(plan.createdAt).toBe('2026-06-06T00:00:00.000Z');
    expect(plan.providers.openai.runtime.source).toBe('config-runtime');
    expect(plan.agents.triage.provider).toMatchObject({
      key: 'openai',
      name: 'openai',
      model: 'gpt-test',
      runtime: { source: 'config-runtime' },
    });
    expect(plan.agents.triage.tools.map((tool) => tool.name)).toEqual(['agent.note', 'issue.create']);
    expect(plan.agents.triage.tools.find((tool) => tool.name === 'issue.create')).toMatchObject({
      category: 'issue',
      tags: ['action', 'escalation', 'issue'],
    });
    expect(plan.agents.triage.policies.map((policy) => policy.name)).toEqual([
      'redact-secrets',
      'limit-tool-scopes',
      'limit-cost',
      'deployment-policy',
      'agent-policy',
    ]);
    expect(plan.harness?.phases[0].toolRefs).toContainEqual({
      name: 'issue.create',
      status: 'resolved',
      source: 'connectors.github',
    });
    expect(plan.harness?.phases[0].toolRefs).toContainEqual({
      name: 'missing.tool',
      status: 'missing',
      source: undefined,
    });
    expect(plan.envRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'GITHUB_TOKEN', sources: ['connectors.github'] }),
      expect.objectContaining({ name: 'OPENAI_API_KEY', sources: ['providers.openai'] }),
    ]));
    expect(plan.artifactStore).toEqual({
      kind: 'local',
      root: '/tmp/fdekit-compiled/artifacts',
    });
    expect(plan.artifactPaths.executionPlan).toBe('/tmp/fdekit-compiled/artifacts/deployments/execution-plan.json');
  });

  it('compiles S3 artifact roots into execution-plan URIs', () => {
    const deployment = defineDeployment({
      name: 's3-artifacts',
      artifacts: {
        kind: 's3',
        bucket: 'fdekit-artifacts',
        prefix: 'teams/support',
        region: 'us-east-1',
        client: s3ArtifactClient,
      },
      providers: {
        mock: { name: 'mock' },
      },
      agents: {
        worker: defineAgent({
          provider: 'mock',
          instructions: './agents/worker.md',
        }),
      },
    });

    const plan = compileDeployment(deployment);

    expect(plan.artifactStore).toEqual({
      kind: 's3',
      root: 's3://fdekit-artifacts/teams/support',
      bucket: 'fdekit-artifacts',
      prefix: 'teams/support',
      region: 'us-east-1',
    });
    expect(plan.artifactPaths.executionPlan).toBe('s3://fdekit-artifacts/teams/support/deployments/execution-plan.json');
    expect(createDeploymentSnapshot(deployment).deployment.artifacts).toEqual({
      kind: 's3',
      bucket: 'fdekit-artifacts',
      prefix: 'teams/support',
      region: 'us-east-1',
    });
  });

  it('uses artifacts as the default S3 prefix', () => {
    const deployment = defineDeployment({
      name: 's3-default-prefix',
      artifacts: {
        kind: 's3',
        bucket: 'fdekit-artifacts',
        client: s3ArtifactClient,
      },
      providers: {
        mock: { name: 'mock' },
      },
      agents: {},
    });

    const plan = compileDeployment(deployment);

    expect(plan.artifactStore).toMatchObject({
      root: 's3://fdekit-artifacts/artifacts',
      prefix: 'artifacts',
    });
    expect(plan.artifactPaths.executionPlan)
      .toBe('s3://fdekit-artifacts/artifacts/deployments/execution-plan.json');
  });

  it('marks used providers without runtime adapters as compile errors', () => {
    const deployment = defineDeployment({
      name: 'missing-runtime',
      providers: {
        openai: { name: 'openai' },
      },
      agents: {
        worker: defineAgent({
          provider: 'openai',
          instructions: './agents/worker.md',
        }),
      },
    });

    const plan = compileDeployment(deployment);

    expect(plan.valid).toBe(false);
    expect(plan.agents.worker.provider.runtime.source).toBe('missing');
    expect(plan.validation.issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      path: 'agents.worker.provider.runtime',
    }));
  });

  it('validates provider, tool, and eval references', () => {
    const deployment = defineDeployment({
      name: 'invalid',
      providers: {},
      connectors: {
        empty: defineConnector({
          name: 'empty',
        }),
      },
      agents: {
        reviewer: defineAgent({
          provider: 'openai',
          instructions: './agents/reviewer.md',
        }),
      },
      evals: [
        {
          name: 'missing-agent',
          agent: 'ghost',
          maxSteps: 0,
        },
      ],
    });

    const result = validateDeployment(deployment);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toContain('providers');
    expect(result.issues.map((issue) => issue.path)).toContain('agents.reviewer.provider');
    expect(result.issues.map((issue) => issue.path)).toContain('evals.missing-agent.agent');
    expect(result.issues.map((issue) => issue.path)).toContain('evals.missing-agent.maxSteps');
    expect(result.issues.some((issue) => issue.severity === 'warning')).toBe(true);
  });

  it('rejects rubric assertions without a configured judge', () => {
    const deployment = defineDeployment({
      name: 'missing-rubric-judge',
      providers: {
        mock: { name: 'mock' },
      },
      agents: {
        reviewer: defineAgent({
          provider: 'mock',
          instructions: './agents/reviewer.md',
        }),
      },
      evals: [
        {
          name: 'answer-quality',
          agent: 'reviewer',
          cases: [
            { name: 'polite-answer', input: { message: 'Help me' } },
          ],
          assertions: [
            judgeRubric({ rubric: 'Answer must be polite and complete.' }),
          ],
        },
      ],
    });

    const result = validateDeployment(deployment);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      severity: 'error',
      path: 'evals.answer-quality.assertions.judge-rubric.judge',
      message: 'judgeRubric requires a judge function; FDEKit does not provide a built-in provider-backed judge',
    });
  });

  it('validates field-method metadata before it reaches reports and snapshots', () => {
    const deployment = defineDeployment({
      name: 'invalid-field-method-metadata',
      providers: {
        mock: { name: 'mock' },
      },
      agents: {
        reviewer: defineAgent({
          provider: 'mock',
          instructions: './agents/reviewer.md',
        }),
      },
      workflow: defineWorkflow({
        name: '',
        owner: { team: 'operations' } as never,
        currentState: {
          handoffs: ['support', 42] as never,
        },
      }),
      outcomeMetrics: [
        defineOutcomeMetric({
          description: 'Missing its required name',
        } as never),
      ],
      dataLayers: defineDataLayers({
        businessRules: ['support policy', false] as never,
      }),
      rollout: defineRollout({
        stage: 12345 as never,
        owner: { team: 'operations' } as never,
      }),
    });

    const result = validateDeployment(deployment);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      {
        severity: 'error',
        path: 'workflow.name',
        message: 'Workflow name must be a non-empty string',
      },
      {
        severity: 'error',
        path: 'workflow.owner',
        message: 'Workflow owner must be a string',
      },
      {
        severity: 'error',
        path: 'workflow.currentState.handoffs.1',
        message: 'Workflow state handoffs entries must be strings',
      },
      {
        severity: 'error',
        path: 'outcomeMetrics.0.name',
        message: 'Outcome metric name must be a non-empty string',
      },
      {
        severity: 'error',
        path: 'dataLayers.businessRules.1',
        message: 'Data layers businessRules entries must be strings',
      },
      {
        severity: 'error',
        path: 'rollout.stage',
        message: 'Rollout stage must be a non-empty string',
      },
      {
        severity: 'error',
        path: 'rollout.owner',
        message: 'Rollout owner must be a string',
      },
    ]));
  });

  it('accepts structurally valid field-method metadata', () => {
    const deployment = defineDeployment({
      name: 'valid-field-method-metadata',
      providers: {
        mock: { name: 'mock' },
      },
      agents: {
        reviewer: defineAgent({
          provider: 'mock',
          instructions: './agents/reviewer.md',
        }),
      },
      workflow: defineWorkflow({
        name: 'Support escalation',
        owner: 'support operations',
        currentState: {
          summary: 'Manual triage',
          handoffs: ['support', 'engineering'],
          baseline: {
            cycleTime: '18 minutes',
            manualSteps: 7,
          },
        },
        targetState: {
          summary: 'Governed agent triage',
          target: 'under 5 minutes',
        },
        scorecard: {
          volume: 'high',
          fragmentedSystems: ['Slack', 'Postgres'],
          measurablePain: ['cycle time'],
        },
      }),
      outcomeMetrics: [
        defineOutcomeMetric({
          name: 'Escalation cycle time',
          baseline: '18 minutes',
          target: 'under 5 minutes',
          owner: 'support operations',
        }),
      ],
      dataLayers: defineDataLayers({
        systemOfRecord: ['Postgres customer profile'],
        businessRules: ['support escalation policy'],
        rawIntake: ['ticket text'],
        feedback: ['approval decisions'],
      }),
      rollout: defineRollout({
        stage: 'shadow',
        stages: ['local', 'shadow', 'approved-write'],
        next: 'Approve five low-risk escalations',
        owner: 'support operations',
      }),
    });

    expect(validateDeployment(deployment)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('warns when harness refs point at unknown tools, policies, evals, or triggers', () => {
    const deployment = defineDeployment({
      name: 'invalid-harness-refs',
      providers: {
        mock: { name: 'mock' },
      },
      connectors: {
        custom: defineConnector({
          name: 'custom',
          tools: [
            defineTool({
              name: 'known.tool',
              argsSchema: { type: 'object', properties: {} },
              handler() {
                return { ok: true };
              },
            }),
          ],
        }),
      },
      agents: {
        worker: defineAgent({
          provider: 'mock',
          instructions: './agents/worker.md',
        }),
      },
      policies: [
        { name: 'known-policy' },
      ],
      evals: [
        {
          name: 'known-eval',
          agent: 'worker',
          cases: [
            { name: 'case', input: {} },
          ],
        },
      ],
      harness: defineHarness({
        name: 'bad-ref-harness',
        phases: [
          {
            name: 'work',
            toolRefs: ['known.tool', 'missing.tool'],
            policyRefs: ['known-policy', 'missing-policy'],
            evalRefs: ['known-eval', 'missing-eval'],
          },
        ],
        toolRefs: ['missing.top-level-tool'],
        policyRefs: ['missing-top-level-policy'],
        evalRefs: ['missing-top-level-eval'],
        review: {
          evalRefs: ['missing-review-eval'],
        },
        steer: {
          enabled: true,
          triggerRefs: ['known-policy', 'known-eval', 'missing-trigger'],
        },
      }),
    });

    const result = validateDeployment(deployment);
    const warningPaths = result.issues
      .filter((issue) => issue.severity === 'warning')
      .map((issue) => issue.path);

    expect(result.valid).toBe(true);
    expect(warningPaths).toEqual(expect.arrayContaining([
      'harness.toolRefs.missing.top-level-tool',
      'harness.policyRefs.missing-top-level-policy',
      'harness.evalRefs.missing-top-level-eval',
      'harness.review.evalRefs.missing-review-eval',
      'harness.steer.triggerRefs.missing-trigger',
      'harness.phases.work.toolRefs.missing.tool',
      'harness.phases.work.policyRefs.missing-policy',
      'harness.phases.work.evalRefs.missing-eval',
    ]));
  });

  it('creates stable snapshots and diffs deployment changes', () => {
    const base = defineDeployment({
      name: 'customer-api-review',
      version: '1.0.0',
      recipe: {
        name: 'codebase-agent',
        version: '0.1.0',
      },
      providers: {
        mock: { name: 'mock', model: 'review-local' },
      },
      connectors: {
        codeQuality: defineConnector({
          name: 'code-quality',
          tools: [
            defineTool({
              name: 'flag-any-types',
              scopes: ['codebase:write'],
              environments: ['local'],
              argsSchema: { type: 'object', properties: {} },
              handler() {
                return { count: 0 };
              },
            }),
          ],
        }),
      },
      agents: {
        reviewer: defineAgent({
          provider: 'mock',
          instructions: './agents/reviewer.md',
        }),
      },
      evals: [
        {
          name: 'review-eval',
          agent: 'reviewer',
          maxSteps: 4,
          assertions: [expectedToolCall('flag-any-types')],
        },
      ],
      workflow: defineWorkflow({
        name: 'Codebase review',
      }),
      rollout: defineRollout({
        stage: 'local',
      }),
      harness: defineHarness({
        name: 'codebase-review-loop',
        phases: [
          {
            name: 'context',
            toolRefs: ['flag-any-types'],
            maxSteps: 2,
          },
        ],
      }),
    });
    const changed = defineDeployment({
      ...base,
      version: '1.1.0',
      providers: {
        mock: { name: 'mock', model: 'review-local-v2' },
      },
      evals: [
        {
          name: 'review-eval',
          agent: 'reviewer',
          maxSteps: 6,
          assertions: [expectedToolCall('flag-any-types')],
        },
      ],
      rollout: defineRollout({
        stage: 'shadow',
      }),
      harness: defineHarness({
        name: 'codebase-review-loop',
        phases: [
          {
            name: 'context',
            toolRefs: ['flag-any-types'],
            maxSteps: 3,
          },
        ],
      }),
    });

    const diff = diffDeploymentSnapshots(
      createDeploymentSnapshot(base, '2026-01-01T00:00:00.000Z'),
      createDeploymentSnapshot(changed, '2026-01-02T00:00:00.000Z'),
    );

    expect(diff.changes).toEqual(expect.arrayContaining([
      {
        kind: 'changed',
        path: 'version',
        before: '1.0.0',
        after: '1.1.0',
      },
      {
        kind: 'changed',
        path: 'providers.mock.model',
        before: 'review-local',
        after: 'review-local-v2',
      },
      {
        kind: 'changed',
        path: 'evals.review-eval.maxSteps',
        before: 4,
        after: 6,
      },
      {
        kind: 'changed',
        path: 'rollout.stage',
        before: 'local',
        after: 'shadow',
      },
      {
        kind: 'changed',
        path: 'harness.phases.0.maxSteps',
        before: 2,
        after: 3,
      },
    ]));
  });

  it('keeps missing tool argsSchema as a warning in local validation', () => {
    const result = validateDeployment(deploymentWithSchemaLessTool('local'));

    expect(result.valid).toBe(true);
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      path: 'connectors.custom.tools.custom.run.argsSchema',
    }));
  });

  it('keeps strict validation explicit for production deployments', () => {
    const result = validateDeployment(deploymentWithSchemaLessTool('production'));

    expect(result.valid).toBe(true);
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      path: 'connectors.custom.tools.custom.run.argsSchema',
    }));
  });

  it('requires tool argsSchema, scopes, and environments when strict validation is enabled', () => {
    const result = validateDeployment(deploymentWithBareTool(), { strict: true });

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      path: 'connectors.custom.tools.custom.run.argsSchema',
    }));
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      path: 'connectors.custom.tools.custom.run.scopes',
    }));
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      path: 'connectors.custom.tools.custom.run.environments',
    }));
  });

  it('warns when the customer-api connector and runtime environment disagree on the customer API URL', () => {
    const result = validateDeployment(deploymentWithCustomerApiWiring({
      connectorBaseUrl: 'http://127.0.0.1:8787',
      runtimeUrl: 'http://127.0.0.1:8788',
    }));

    expect(result.valid).toBe(true);
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      path: 'connectors.customerApi.baseUrl',
      message: expect.stringContaining('does not match the runtime environment customer API URL'),
    }));
  });

  it('accepts matching customer API URLs that differ only by trailing slash', () => {
    const result = validateDeployment(deploymentWithCustomerApiWiring({
      connectorBaseUrl: 'http://127.0.0.1:8787',
      runtimeUrl: 'http://127.0.0.1:8787/',
    }));

    expect(result.issues).not.toContainEqual(expect.objectContaining({
      path: 'connectors.customerApi.baseUrl',
    }));
  });

  it('warns when a live connector mode runs under the local environment label', () => {
    const local = validateDeployment(deploymentWithModeConnector('local', 'api'));

    expect(local.issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      path: 'connectors.github.mode',
      message: expect.stringContaining('live "api" mode while the deployment environment is "local"'),
    }));

    const production = validateDeployment(deploymentWithModeConnector('production', 'api'));

    expect(production.issues).not.toContainEqual(expect.objectContaining({
      path: 'connectors.github.mode',
    }));

    const localMode = validateDeployment(deploymentWithModeConnector('local', 'local'));

    expect(localMode.issues).not.toContainEqual(expect.objectContaining({
      path: 'connectors.github.mode',
    }));
  });

  it('warns when a connector targets a non-local URL under the local environment label', () => {
    const result = validateDeployment(deploymentWithCustomerApiWiring({
      connectorBaseUrl: 'https://api.customer.example',
    }));

    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      path: 'connectors.customerApi.baseUrl',
      message: expect.stringContaining('non-local URL'),
    }));

    const loopback = validateDeployment(deploymentWithCustomerApiWiring({
      connectorBaseUrl: 'http://localhost:8787',
    }));

    expect(loopback.issues).not.toContainEqual(expect.objectContaining({
      path: 'connectors.customerApi.baseUrl',
    }));
  });


  it('errors when a connector references an environment endpoint that is not exported', () => {
    const missingEnvironment = validateDeployment(deploymentWithEndpointRef({ runtimeEnvironment: false, exportEndpoint: false }));

    expect(missingEnvironment.valid).toBe(false);
    expect(missingEnvironment.issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      path: 'connectors.customerApi.baseUrl',
      message: expect.stringContaining('no runtimeEnvironment'),
    }));

    const missingEndpoint = validateDeployment(deploymentWithEndpointRef({ runtimeEnvironment: true, exportEndpoint: false }));

    expect(missingEndpoint.valid).toBe(false);
    expect(missingEndpoint.issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      path: 'connectors.customerApi.baseUrl',
      message: expect.stringContaining('does not export it'),
    }));
  });

  it('accepts a connector environment endpoint ref that the runtime environment exports', () => {
    const result = validateDeployment(deploymentWithEndpointRef({ runtimeEnvironment: true, exportEndpoint: true }));

    expect(result.valid).toBe(true);
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      path: 'connectors.customerApi.baseUrl',
    }));
  });
});

function deploymentWithEndpointRef(options: { runtimeEnvironment: boolean; exportEndpoint: boolean }) {
  return defineDeployment({
    name: 'endpoint-ref',
    environment: 'local',
    providers: {
      mock: { name: 'mock' },
    },
    runtimeEnvironment: options.runtimeEnvironment
      ? {
        name: 'docker-env',
        kind: 'local-docker',
        evidence: {
          kind: 'local-docker',
          name: 'docker-env',
          endpoints: options.exportEndpoint
            ? [{ name: 'customer-api', url: 'http://127.0.0.1:8787' }]
            : [],
        },
      }
      : undefined,
    connectors: {
      customerApi: defineConnector({
        name: 'customer-api',
        config: { baseUrl: 'environment://customer-api' },
        tools: [
          defineTool({
            name: 'customer.get',
            scopes: ['customer:read'],
            environments: ['local'],
            argsSchema: { type: 'object' },
            handler() {
              return { ok: true };
            },
          }),
        ],
      }),
    },
    agents: {
      worker: defineAgent({
        provider: 'mock',
        instructions: './agents/worker.md',
      }),
    },
  });
}

function deploymentWithCustomerApiWiring(options: {
  connectorBaseUrl: string;
  runtimeUrl?: string;
}) {
  return defineDeployment({
    name: 'customer-api-wiring',
    environment: 'local',
    providers: {
      mock: { name: 'mock' },
    },
    runtimeEnvironment: options.runtimeUrl
      ? {
        name: 'docker-env',
        kind: 'local-docker',
        config: {
          customerApi: { url: options.runtimeUrl },
        },
      }
      : undefined,
    connectors: {
      customerApi: defineConnector({
        name: 'customer-api',
        config: { baseUrl: options.connectorBaseUrl },
        tools: [
          defineTool({
            name: 'customer.get',
            scopes: ['customer:read'],
            environments: ['local'],
            argsSchema: { type: 'object' },
            handler() {
              return { ok: true };
            },
          }),
        ],
      }),
    },
    agents: {
      worker: defineAgent({
        provider: 'mock',
        instructions: './agents/worker.md',
      }),
    },
  });
}

function deploymentWithModeConnector(environment: 'local' | 'production', mode: 'local' | 'api') {
  return defineDeployment({
    name: `mode-${environment}-${mode}`,
    environment,
    providers: {
      mock: { name: 'mock' },
    },
    connectors: {
      github: defineConnector({
        name: 'github',
        config: { mode, apiBaseUrl: 'https://api.github.com' },
        tools: [
          defineTool({
            name: 'issue.create',
            scopes: ['issue:write'],
            environments: [environment],
            argsSchema: { type: 'object' },
            handler() {
              return { ok: true };
            },
          }),
        ],
      }),
    },
    agents: {
      worker: defineAgent({
        provider: 'mock',
        instructions: './agents/worker.md',
      }),
    },
  });
}

function deploymentWithBareTool() {
  return defineDeployment({
    name: 'strict-bare-tool',
    environment: 'local',
    providers: {
      mock: { name: 'mock' },
    },
    connectors: {
      custom: defineConnector({
        name: 'custom',
        tools: [
          defineTool({
            name: 'custom.run',
            handler() {
              return { ok: true };
            },
          }),
        ],
      }),
    },
    agents: {
      worker: defineAgent({
        provider: 'mock',
        instructions: './agents/worker.md',
      }),
    },
  });
}

function deploymentWithSchemaLessTool(environment: 'local' | 'production') {
  return defineDeployment({
    name: `schema-${environment}`,
    environment,
    providers: {
      mock: { name: 'mock' },
    },
    connectors: {
      custom: defineConnector({
        name: 'custom',
        tools: [
          defineTool({
            name: 'custom.run',
            scopes: ['custom:write'],
            environments: [environment],
            handler() {
              return { ok: true };
            },
          }),
        ],
      }),
    },
    agents: {
      worker: defineAgent({
        provider: 'mock',
        instructions: './agents/worker.md',
      }),
    },
  });
}
