import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  asRecord,
  defineAgent,
  defineConnector,
  defineDeployment,
  defineGovernance,
  defineHarness,
  definePolicy,
  defineTool,
  denyPIILeak,
  limitToolScopes,
  limitToolUse,
  requireApproval,
  restrictEnvironments,
  getString,
  type DeploymentDefinition,
  type ProviderPlanContext,
  type ProviderStep,
  type ProviderToolResult,
  type ToolDefinition,
} from '@fdekit/core';
import {
  AgentRunError,
  executeGovernedToolSequence,
  resumeAgentRun,
  revisePausedApproval,
  runAgent,
  type AgentContextPlanningOptions,
  type PausedRunArtifact,
} from '../agents/index.js';
import {
  ApprovalDecisionConflictError,
  approveApproval,
  readApproval,
  readApprovals,
  readAuditLog,
  rejectApproval,
} from '../governance/index.js';
import { readJsonArtifact } from '../artifact-store/index.js';
import { createFileSessionStore, type SessionStore } from '../sessions/index.js';

function plannedContextOptions(
  overrides: Partial<AgentContextPlanningOptions> = {},
): AgentContextPlanningOptions {
  return {
    policy: {
      schemaVersion: 1,
      version: 'review-policy.v1',
      fingerprint: 'policy-fingerprint',
      evaluatedAt: '2026-08-20T12:00:00.000Z',
      decision: 'allow',
      capabilities: ['source:read', 'tool:execute'],
      approvalRequiredFor: [],
      sourceAllowlist: ['repo-authorized'],
      targetAllowlist: ['review-target'],
      budget: { maxInputTokens: 10_000, maxOutputTokens: 1_000, maxToolCalls: 4 },
      reasons: ['Test policy allows the review route'],
    },
    routes: [{
      target: {
        id: 'review-target',
        provider: 'routed-provider',
        model: 'review-model',
        capabilities: {
          inputModalities: ['text'],
          outputModalities: ['text'],
          contextWindowTokens: 32_000,
          maxOutputTokens: 4_000,
          toolCalls: true,
          structuredOutput: true,
          streaming: false,
          reasoning: false,
          promptCaching: false,
        },
      },
      endpoint: {
        id: 'private-us',
        provider: 'routed-provider',
        credentialRef: 'secret://routed-provider',
        region: 'us-east',
        trustBoundary: 'private',
      },
    }],
    requirements: { inputModalities: ['text'], outputModalities: ['text'] },
    objectives: {
      relevance: 1,
      freshness: 0.5,
      authority: 1,
      completeness: 0.5,
      latency: 0.2,
      cost: 0.2,
    },
    requestedSourceIds: ['repo-authorized'],
    items: [{
      item: {
        id: 'authorized-evidence',
        kind: 'evidence',
        content: 'Grounded repository evidence',
        sourceIds: ['repo-authorized'],
      },
      estimatedTokens: 8,
      priority: 10,
    }],
    ...overrides,
  };
}

describe('runAgent', () => {
  it('batches non-critical telemetry between immediate lifecycle boundaries', async () => {
    const projectDir = await mkRunProjectDir();
    const fileStore = createFileSessionStore({ projectDir });
    const batchSizes: number[] = [];
    const sessionStore: SessionStore = {
      ...fileStore,
      async appendBatch(sessionId, events, options) {
        batchSizes.push(events.length);
        return fileStore.appendBatch!(sessionId, events, options);
      },
    };
    const deployment = defineDeployment({
      name: 'batched-observability',
      providers: {
        deterministic: {
          name: 'deterministic',
          runtime: {
            name: 'deterministic',
            planNextStep: () => ({ type: 'final', message: 'done' }),
          },
        },
      },
      agents: { observer: defineAgent({ provider: 'deterministic', instructions: 'Observe.' }) },
    });

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'observer',
      input: {},
      sessionStore,
    });

    expect(result.status).toBe('completed');
    expect(batchSizes).toEqual([1, 5]);
    expect(await fileStore.readEvents(result.id)).toHaveLength(6);
  });

  it('runs a deterministic support escalation loop with tool calls and traces', async () => {
    const deployment = createSupportTriageDeployment();
    const projectDir = await mkRunProjectDir();

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
    });

    expect(result.status).toBe('completed');
    expect(result.provider).toBe('mock');
    expect(result.finalAnswer).toContain('was escalated');
    expect(result.policyViolations).toEqual([]);
    expect(result.toolCalls.map((call) => call.name)).toEqual([
      'ticket.get',
      'customer.get',
      'issue.create',
      'slack.message',
      'ticket.escalate',
    ]);
    expect(result.trace.events.map((event) => event.type)).toContain('provider.step.tool_call');
    expect(result.trace.events.at(-1)).toMatchObject({
      type: 'agent.run.completed',
      status: 'completed',
    });

    const sessionStore = createFileSessionStore({ projectDir });
    const durableEvents = await sessionStore.readEvents<Record<string, unknown>>(result.id);
    expect(durableEvents.map((event) => event.type)).toEqual(
      result.trace.events.map((event) => event.type),
    );
    expect(await sessionStore.getProjection(result.id)).toMatchObject({
      state: 'completed',
      revision: result.trace.events.length,
    });
  }, 15_000);

  it('keeps standard support tickets out of the escalation path', async () => {
    const deployment = createSupportTriageDeployment();
    const projectDir = await mkRunProjectDir();

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1002' },
    });

    expect(result.status).toBe('completed');
    expect(result.finalAnswer).toContain('standard support triage');
    expect(result.toolCalls.map((call) => call.name)).toEqual([
      'ticket.get',
      'customer.get',
    ]);
  });

  it('runs a provider adapter supplied by provider config', async () => {
    const projectDir = await mkRunProjectDir();
    const deployment = defineDeployment({
      name: 'test-config-provider-runtime',
      environment: 'local',
      providers: {
        custom: {
          name: 'custom',
          model: 'custom-model',
          runtime: (config) => ({
            name: config.name,
            planNextStep: () => ({
              type: 'final',
              message: `Config runtime completed with ${config.model}`,
            }),
          }),
        },
      },
      agents: {
        customAgent: defineAgent({
          provider: 'custom',
          model: 'agent-model',
          instructions: 'Use the custom provider',
        }),
      },
    });

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'customAgent',
      input: { task: 'say hello' },
    });

    expect(result.status).toBe('completed');
    expect(result.provider).toBe('custom');
    expect(result.finalAnswer).toBe('Config runtime completed with agent-model');
  });

  it('routes policy-planned steps through the selected endpoint and exposes only compiled model context', async () => {
    const projectDir = await mkRunProjectDir();
    let configuredModel: string | undefined;
    let receivedContext: ProviderPlanContext | undefined;
    const deployment = defineDeployment({
      name: 'test-context-routed-runtime',
      environment: 'local',
      providers: {
        fallback: {
          name: 'fallback',
          runtime: {
            name: 'fallback',
            planNextStep: () => {
              throw new Error('fallback provider must not run');
            },
          },
        },
        'private-us': {
          name: 'routed-provider',
          model: 'deployment-default',
          runtime: (config) => {
            configuredModel = config.model;
            return {
              name: config.name,
              planNextStep(context) {
                receivedContext = context;
                return { type: 'final', message: 'Routed review complete' };
              },
            };
          },
        },
      },
      agents: {
        reviewer: defineAgent({
          provider: 'fallback',
          instructions: 'Review only authorized evidence.',
        }),
      },
    });
    const contextPlanning = plannedContextOptions();

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'reviewer',
      input: { objective: 'review pull request 42' },
      taskId: 'task-42',
      attemptId: 'attempt-1',
      contextPlanning,
    });

    expect(result.status).toBe('completed');
    expect(result.provider).toBe('routed-provider');
    expect(configuredModel).toBe('review-model');
    expect(receivedContext).toMatchObject({
      deployment: { name: 'test-context-routed-runtime', providers: {}, agents: {} },
      agent: { instructions: '' },
      input: {},
      instructions: '',
      toolResults: [],
      outputTokenLimit: 1_000,
      modelContext: {
        evidence: [{ id: 'authorized-evidence', content: 'Grounded repository evidence' }],
      },
    });
    expect(receivedContext).not.toHaveProperty('contextPlan');
    expect(receivedContext?.modelContext?.instructions.map((item) => item.id)).toEqual([
      'fdekit:agent-instructions',
      'fdekit:run-input',
    ]);

    const planEvent = result.trace.events.find((event) => event.type === 'context.plan.selected');
    expect(planEvent).toMatchObject({
      identity: { taskId: 'task-42', attemptId: 'attempt-1', stepId: expect.stringContaining(':step:0') },
      policy: { fingerprint: 'policy-fingerprint', decision: 'allow' },
      target: { id: 'review-target', provider: 'routed-provider', model: 'review-model' },
      endpoint: { id: 'private-us', provider: 'routed-provider', region: 'us-east' },
      model: { evidenceIds: ['authorized-evidence'] },
    });
    expect(JSON.stringify(planEvent)).not.toContain('secret://routed-provider');
    expect(JSON.stringify(planEvent)).not.toContain('Grounded repository evidence');
    expect(result.usage).toEqual([
      expect.objectContaining({
        provider: 'routed-provider',
        model: 'review-model',
        status: 'unknown',
        toolCalls: 0,
      }),
    ]);
    expect(result.usage[0]).not.toHaveProperty('inputTokens');
  });

  it('records measured provider usage and estimated target cost without inventing fields', async () => {
    const projectDir = await mkRunProjectDir();
    const contextPlanning = plannedContextOptions();
    contextPlanning.routes[0].target.pricing = {
      currency: 'USD',
      inputPerMillionTokens: 10,
      cachedInputPerMillionTokens: 2,
      cacheWriteInputPerMillionTokens: 12,
      outputPerMillionTokens: 20,
    };
    const deployment = defineDeployment({
      name: 'test-context-usage',
      environment: 'local',
      providers: {
        'private-us': {
          name: 'routed-provider',
          runtime: {
            name: 'routed-provider',
            planNextStep: () => ({
              type: 'final',
              message: 'Measured review complete',
              usage: {
                inputTokens: 105,
                cachedInputTokens: 20,
                cacheWriteInputTokens: 5,
                outputTokens: 50,
                reasoningTokens: 5,
              },
            }),
          },
        },
      },
      agents: {
        reviewer: defineAgent({ instructions: 'Review the change.' }),
      },
    });

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'reviewer',
      input: {},
      taskId: 'usage-task',
      attemptId: 'usage-attempt',
      contextPlanning,
    });

    expect(result.costUsd).toBeCloseTo(0.0019);
    expect(result.usage).toEqual([expect.objectContaining({
      schemaVersion: 1,
      identity: expect.objectContaining({ taskId: 'usage-task', attemptId: 'usage-attempt' }),
      provider: 'routed-provider',
      model: 'review-model',
      inputTokens: 105,
      cachedInputTokens: 20,
      cacheWriteInputTokens: 5,
      outputTokens: 50,
      reasoningTokens: 5,
      toolCalls: 0,
      cost: 0.0019,
      currency: 'USD',
      status: 'measured',
      metadata: { costStatus: 'estimated' },
    })]);
    expect(result.trace.events).toContainEqual(expect.objectContaining({
      type: 'provider.usage',
      status: 'measured',
      inputTokens: 105,
      outputTokens: 50,
      cost: 0.0019,
    }));
  });

  it('durably pauses for structured input and resumes only with a schema-valid answer', async () => {
    const projectDir = await mkRunProjectDir();
    let resumedToolResults: unknown[] = [];
    const deployment = defineDeployment({
      name: 'test-needs-input',
      environment: 'local',
      providers: {
        interactive: {
          name: 'interactive',
          runtime: {
            name: 'interactive',
            planNextStep(context) {
              if (context.stepIndex === 0) {
                return {
                  type: 'input_request',
                  prompt: 'Which repository should be reviewed?',
                  inputSchema: {
                    type: 'object',
                    required: ['repository'],
                    properties: { repository: { type: 'string', minLength: 1 } },
                    additionalProperties: false,
                  },
                  disclosure: 'restricted',
                };
              }
              resumedToolResults = context.toolResults;
              return { type: 'final', message: 'Input accepted' };
            },
          },
        },
      },
      agents: {
        reviewer: defineAgent({ provider: 'interactive', instructions: 'Review a repository.' }),
      },
    });

    const paused = await runAgent({
      deployment,
      projectDir,
      agentName: 'reviewer',
      input: {},
      inputGate: {
        audience: [{ id: 'developer-1', kind: 'user' }],
        requireResumeToken: true,
        disclosure: 'restricted',
      },
    });
    expect(paused).toMatchObject({
      status: 'waiting_input',
      inputRequests: [expect.objectContaining({
        status: 'pending',
        prompt: 'Which repository should be reviewed?',
        disclosure: 'restricted',
      })],
    });
    expect(paused.inputResumeToken).toEqual(expect.any(String));
    const pausedArtifact = await readJsonArtifact<PausedRunArtifact>(
      projectDir,
      'runs',
      `${paused.id}.json`,
    );
    expect(JSON.stringify(pausedArtifact)).not.toContain(paused.inputResumeToken);
    const sessions = createFileSessionStore({ projectDir });
    expect(await sessions.getProjection(paused.id)).toMatchObject({ state: 'needs_input' });

    const stillPaused = await resumeAgentRun({ deployment, projectDir, runId: paused.id });
    expect(stillPaused.status).toBe('waiting_input');
    await expect(resumeAgentRun({
      deployment,
      projectDir,
      runId: paused.id,
      inputAnswer: {
        value: {},
        answeredBy: { id: 'developer-1', kind: 'user' },
        resumeToken: paused.inputResumeToken,
      },
    })).rejects.toThrow('Input answer $.repository: Required property is missing');
    await expect(resumeAgentRun({
      deployment,
      projectDir,
      runId: paused.id,
      inputAnswer: {
        value: { repository: 'fdekit' },
        answeredBy: { id: 'developer-2', kind: 'user' },
        resumeToken: paused.inputResumeToken,
      },
    })).rejects.toThrow('Actor developer-2 is not an intended principal');
    await expect(resumeAgentRun({
      deployment,
      projectDir,
      runId: paused.id,
      inputAnswer: {
        value: { repository: 'fdekit' },
        answeredBy: { id: 'developer-1', kind: 'user' },
        resumeToken: 'wrong-token',
      },
    })).rejects.toThrow('requires its valid resume token');

    const completed = await resumeAgentRun({
      deployment,
      projectDir,
      runId: paused.id,
      inputAnswer: {
        value: { repository: 'fdekit' },
        answeredBy: { id: 'developer-1', kind: 'user' },
        resumeToken: paused.inputResumeToken,
      },
    });
    expect(completed.status).toBe('completed');
    expect(resumedToolResults).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'fdekit.input',
        result: { repository: 'fdekit' },
      }),
    ]));
    expect(completed.trace.events).toContainEqual(expect.objectContaining({
      type: 'input.answered',
      answeredBy: 'developer-1',
    }));
  });

  it('fails closed when a configured human-input deadline has already elapsed', async () => {
    const projectDir = await mkRunProjectDir();
    const deployment = defineDeployment({
      name: 'expired-input-deadline',
      environment: 'local',
      providers: {
        interactive: {
          name: 'interactive',
          runtime: {
            name: 'interactive',
            planNextStep: () => ({
              type: 'input_request',
              prompt: 'Confirm the target',
              inputSchema: { type: 'string' },
            }),
          },
        },
      },
      agents: {
        reviewer: defineAgent({ provider: 'interactive', instructions: 'Review.' }),
      },
    });

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'reviewer',
      input: {},
      inputGate: { deadlineAt: '2020-01-01T00:00:00.000Z' },
    })).rejects.toMatchObject({
      name: 'AgentRunError',
      result: expect.objectContaining({
        status: 'failed',
        finalAnswer: expect.stringContaining('has already elapsed'),
      }),
    });
  });

  it('fails after a measured provider step exceeds the declared cost budget', async () => {
    const projectDir = await mkRunProjectDir();
    let providerCalls = 0;
    const contextPlanning = plannedContextOptions({
      budget: { maxInputTokens: 10_000, maxOutputTokens: 1_000, maxCost: 0.001 },
    });
    contextPlanning.routes[0].target.pricing = {
      currency: 'USD',
      inputPerMillionTokens: 10,
      outputPerMillionTokens: 20,
    };
    const deployment = defineDeployment({
      name: 'test-context-cost-budget',
      environment: 'local',
      providers: {
        'private-us': {
          name: 'routed-provider',
          runtime: {
            name: 'routed-provider',
            planNextStep: () => {
              providerCalls += 1;
              return {
                type: 'final',
                message: 'This answer is over budget',
                usage: { inputTokens: 100, outputTokens: 50 },
              };
            },
          },
        },
      },
      agents: {
        reviewer: defineAgent({ instructions: 'Review the change.' }),
      },
    });

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'reviewer',
      input: {},
      contextPlanning,
    })).rejects.toMatchObject({
      name: 'AgentRunError',
      result: {
        status: 'failed',
        finalAnswer: 'Inference cost budget exceeded: 0.002 USD used, limit 0.001 USD',
        costUsd: 0.002,
        usage: [expect.objectContaining({ status: 'measured', cost: 0.002 })],
      },
    });
    expect(providerCalls).toBe(1);
  });

  it('fails a hard cost budget when cache-write usage has no declared price', async () => {
    const projectDir = await mkRunProjectDir();
    const contextPlanning = plannedContextOptions({
      budget: { maxInputTokens: 10_000, maxOutputTokens: 1_000, maxCost: 0.01 },
    });
    contextPlanning.routes[0].target.pricing = {
      currency: 'USD',
      inputPerMillionTokens: 10,
      cachedInputPerMillionTokens: 2,
      outputPerMillionTokens: 20,
    };
    const deployment = defineDeployment({
      name: 'test-context-cache-write-cost',
      environment: 'local',
      providers: {
        'private-us': {
          name: 'routed-provider',
          runtime: {
            name: 'routed-provider',
            planNextStep: () => ({
              type: 'final',
              message: 'Cache write price is missing',
              usage: {
                inputTokens: 105,
                cacheWriteInputTokens: 5,
                outputTokens: 25,
              },
            }),
          },
        },
      },
      agents: {
        reviewer: defineAgent({ instructions: 'Review the change.' }),
      },
    });

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'reviewer',
      input: {},
      contextPlanning,
    })).rejects.toMatchObject({
      name: 'AgentRunError',
      result: {
        status: 'failed',
        finalAnswer: 'Inference cost budget could not be verified because provider usage was unavailable or incomplete',
        usage: [expect.objectContaining({
          status: 'measured',
          inputTokens: 105,
          cacheWriteInputTokens: 5,
        })],
      },
    });
  });

  it('rejects an unenforceable cost budget before calling an unpriced target', async () => {
    const projectDir = await mkRunProjectDir();
    let providerCalls = 0;
    const deployment = defineDeployment({
      name: 'test-context-unpriced-budget',
      environment: 'local',
      providers: {
        'private-us': {
          name: 'routed-provider',
          runtime: {
            name: 'routed-provider',
            planNextStep: () => {
              providerCalls += 1;
              return { type: 'final', message: 'Must not execute' };
            },
          },
        },
      },
      agents: {
        reviewer: defineAgent({ instructions: 'Review the change.' }),
      },
    });

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'reviewer',
      input: {},
      contextPlanning: plannedContextOptions({
        budget: { maxInputTokens: 10_000, maxOutputTokens: 1_000, maxCost: 0.01 },
      }),
    })).rejects.toMatchObject({
      name: 'AgentRunError',
      result: {
        status: 'failed',
        finalAnswer: 'Inference cost budget cannot be enforced for unpriced target "review-target"',
      },
    });
    expect(providerCalls).toBe(0);
  });

  it('fails a hard cost budget when a priced provider omits usage', async () => {
    const projectDir = await mkRunProjectDir();
    const contextPlanning = plannedContextOptions({
      budget: { maxInputTokens: 10_000, maxOutputTokens: 1_000, maxCost: 0.01 },
    });
    contextPlanning.routes[0].target.pricing = {
      currency: 'USD',
      inputPerMillionTokens: 10,
      outputPerMillionTokens: 20,
    };
    const deployment = defineDeployment({
      name: 'test-context-unknown-cost',
      environment: 'local',
      providers: {
        'private-us': {
          name: 'routed-provider',
          runtime: {
            name: 'routed-provider',
            planNextStep: () => ({ type: 'final', message: 'Usage unavailable' }),
          },
        },
      },
      agents: {
        reviewer: defineAgent({ instructions: 'Review the change.' }),
      },
    });

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'reviewer',
      input: {},
      contextPlanning,
    })).rejects.toMatchObject({
      name: 'AgentRunError',
      result: {
        status: 'failed',
        finalAnswer: 'Inference cost budget could not be verified because provider usage was unavailable or incomplete',
        usage: [expect.objectContaining({ status: 'unknown' })],
      },
    });
  });

  it('blocks provider calls to tools excluded by the step context budget', async () => {
    const projectDir = await mkRunProjectDir();
    let betaCalls = 0;
    const deployment = defineDeployment({
      name: 'test-context-tool-budget',
      environment: 'local',
      providers: {
        'private-us': {
          name: 'routed-provider',
          runtime: {
            name: 'routed-provider',
            planNextStep: () => ({ type: 'tool_call', toolName: 'beta.write', args: {} }),
          },
        },
      },
      agents: {
        reviewer: defineAgent({
          instructions: 'Use an allowed tool.',
          tools: [
            defineTool({ name: 'alpha.read', handler: () => ({ ok: true }) }),
            defineTool({
              name: 'beta.write',
              handler: () => {
                betaCalls += 1;
                return { ok: true };
              },
            }),
          ],
        }),
      },
    });

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'reviewer',
      input: {},
      contextPlanning: plannedContextOptions({
        budget: { maxInputTokens: 10_000, maxOutputTokens: 1_000, maxToolCalls: 1 },
      }),
    })).rejects.toMatchObject({
      name: 'AgentRunError',
      result: {
        status: 'failed',
        finalAnswer: 'Context plan does not allow tool "beta.write" at step 0',
      },
    });
    expect(betaCalls).toBe(0);
  });

  it('preserves the governing context plan across approval pause and resume', async () => {
    const projectDir = await mkRunProjectDir();
    let writes = 0;
    const deployment = defineDeployment({
      name: 'test-context-planned-resume',
      environment: 'local',
      providers: {
        'private-us': {
          name: 'routed-provider',
          runtime: {
            name: 'routed-provider',
            planNextStep(context) {
              return context.modelContext?.recentActions.length
                ? { type: 'final', message: 'Approved write completed' }
                : { type: 'tool_call', toolName: 'issue.create', args: { title: 'Review finding' } };
            },
          },
        },
      },
      agents: {
        reviewer: defineAgent({
          instructions: 'Create the reviewed issue.',
          tools: [defineTool({
            name: 'issue.create',
            handler: () => {
              writes += 1;
              return { id: 'ISSUE-42' };
            },
          })],
          policies: [requireApproval({ tools: ['issue.create'], reason: 'Writes require review' })],
        }),
      },
    });
    const contextPlanning = plannedContextOptions();
    const paused = await runAgent({
      deployment,
      projectDir,
      agentName: 'reviewer',
      input: {},
      contextPlanning,
    });

    expect(paused.status).toBe('waiting_approval');
    expect(writes).toBe(0);
    const artifact = await readJsonArtifact<PausedRunArtifact>(projectDir, 'runs', `${paused.id}.json`);
    expect(artifact).toMatchObject({
      contextPlanningRequired: true,
      contextPolicyFingerprint: 'policy-fingerprint',
      contextPlan: {
        target: { id: 'review-target' },
        endpoint: { id: 'private-us' },
        model: { tools: [{ name: 'issue.create' }] },
      },
    });
    await expect(resumeAgentRun({
      deployment,
      projectDir,
      runId: paused.id,
    })).rejects.toThrow('requires contextPlanning options');

    await approveApproval(projectDir, paused.approvals[0].id, { actor: 'reviewer' });
    const completed = await resumeAgentRun({
      deployment,
      projectDir,
      runId: paused.id,
      contextPlanning,
    });

    expect(completed.status).toBe('completed');
    expect(completed.finalAnswer).toBe('Approved write completed');
    expect(writes).toBe(1);
    expect(completed.toolCalls.map((call) => call.name)).toEqual(['issue.create']);
  });

  it('runs a provider adapter supplied by a runtime registry', async () => {
    const projectDir = await mkRunProjectDir();
    const deployment = defineDeployment({
      name: 'test-registry-provider-runtime',
      environment: 'local',
      providers: {
        custom: {
          name: 'registered-provider',
          model: 'registered-model',
        },
      },
      agents: {
        customAgent: defineAgent({
          provider: 'custom',
          instructions: 'Use the registered provider',
        }),
      },
    });

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'customAgent',
      input: { task: 'say hello' },
      providerRegistry: {
        'registered-provider': (config) => ({
          name: config.name,
          planNextStep: () => ({
            type: 'final',
            message: `Registry runtime completed with ${config.model}`,
          }),
        }),
      },
    });

    expect(result.status).toBe('completed');
    expect(result.provider).toBe('registered-provider');
    expect(result.finalAnswer).toBe('Registry runtime completed with registered-model');
  });

  it('returns tool handler failures to the provider so the loop can recover', async () => {
    const projectDir = await mkRunProjectDir();
    const seenToolResults: ProviderToolResult[][] = [];
    const deployment = defineDeployment({
      name: 'recoverable-tool-error',
      environment: 'local',
      providers: {
        recovering: {
          name: 'recovering',
          runtime: {
            name: 'recovering',
            planNextStep(context) {
              seenToolResults.push([...context.toolResults]);

              if (!findToolResult(context.toolResults, 'customer.get')) {
                return {
                  type: 'tool_call',
                  toolName: 'customer.get',
                  args: { customerId: 'tick_1001' },
                };
              }

              if (!findToolResult(context.toolResults, 'ticket.get')) {
                return {
                  type: 'tool_call',
                  toolName: 'ticket.get',
                  args: { ticketId: 'tick_1001' },
                };
              }

              return {
                type: 'final',
                message: 'Recovered after fetching the ticket first',
              };
            },
          },
        },
      },
      agents: {
        supportTriage: defineAgent({
          provider: 'recovering',
          instructions: 'Recover from a bad customer lookup by fetching the ticket first',
          tools: [
            defineTool<{ customerId: string }>({
              name: 'customer.get',
              handler(args) {
                throw new Error(`Customer API request failed: 404 Not Found (${args.customerId})`);
              },
            }),
            defineTool<{ ticketId: string }>({
              name: 'ticket.get',
              handler(args) {
                return { id: args.ticketId, customerId: 'cus_company' };
              },
            }),
          ],
        }),
      },
    });

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
      maxSteps: 4,
    });

    // The loop recovered, but the failed external call must stay visible in the status.
    expect(result.status).toBe('completed_with_errors');
    expect(result.finalAnswer).toBe('Recovered after fetching the ticket first');
    expect(result.toolCalls.map((call) => call.name)).toEqual(['customer.get', 'ticket.get']);
    expect(result.toolCalls[0]).toMatchObject({
      name: 'customer.get',
      is_error: true,
      result: {
        error: {
          name: 'Error',
          message: 'Customer API request failed: 404 Not Found (tick_1001)',
        },
      },
    });
    expect(result.toolCalls[1]).not.toHaveProperty('is_error');

    const recoveredContext = seenToolResults.find((toolResults) => toolResults.length === 1);
    expect(recoveredContext?.[0]).toMatchObject({
      name: 'customer.get',
      is_error: true,
    });
    expect(result.trace.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'tool.call.failed',
        toolName: 'customer.get',
        is_error: true,
      }),
      expect.objectContaining({
        type: 'tool.call.completed',
        toolName: 'ticket.get',
      }),
    ]));

    const audit = await readAuditLog(projectDir);
    expect(audit.find((entry) => entry.action === 'tool.call.failed')).toMatchObject({
      outcome: 'failed',
      toolName: 'customer.get',
    });
  });

  it('asks for an explicit adapter when a non-mock provider config has no runtime', async () => {
    const projectDir = await mkRunProjectDir();
    const deployment = defineDeployment({
      name: 'test-missing-provider-runtime',
      environment: 'local',
      providers: {
        custom: {
          name: 'custom',
          model: 'custom-model',
        },
      },
      agents: {
        customAgent: defineAgent({
          provider: 'custom',
          instructions: 'Use the custom provider',
        }),
      },
    });

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'customAgent',
      input: { task: 'say hello' },
    })).rejects.toThrow('Provider "custom" does not have a runtime adapter');
  });

  it('blocks tool execution when a policy denies a provider-planned call', async () => {
    const deployment = createSupportTriageDeployment([
      definePolicy({
        name: 'deny-escalation',
        beforeToolCall(toolName) {
          return toolName === 'ticket.escalate'
            ? { allowed: false, reason: 'Escalation queue is frozen' }
            : true;
        },
      }),
    ]);
    const projectDir = await mkRunProjectDir();

    let failure: AgentRunError | undefined;

    try {
      await runAgent({
        deployment,
        projectDir,
        agentName: 'supportTriage',
        input: { ticketId: 'tick_1001' },
      });
    } catch (err) {
      expect(err).toBeInstanceOf(AgentRunError);
      failure = err as AgentRunError;
    }

    expect(failure?.message).toBe('Policy "deny-escalation" blocked ticket.escalate: Escalation queue is frozen');
    expect(failure?.result).toMatchObject({
      status: 'failed',
      agent: 'supportTriage',
      policyViolations: [
        expect.objectContaining({
          policy: 'deny-escalation',
          toolName: 'ticket.escalate',
        }),
      ],
    });
    expect(failure?.result.trace.events.at(-1)).toMatchObject({
      type: 'agent.run.completed',
      status: 'failed',
      message: 'Policy "deny-escalation" blocked ticket.escalate: Escalation queue is frozen',
    });
  });

  it('steers and then blocks repeated identical tool calls before executing them again', async () => {
    const projectDir = await mkRunProjectDir();
    let handled = 0;
    const observedToolResults: ProviderToolResult[][] = [];
    const repeatedArgs = { query: 'interface', maxResults: 1 };
    const deployment = defineDeployment({
      name: 'repeated-tool-steering',
      environment: 'local',
      providers: {
        mock: {
          name: 'mock',
          options: {
            planner(context: ProviderPlanContext): ProviderStep {
              observedToolResults.push(context.toolResults);

              return {
                type: 'tool_call',
                toolName: 'codebase.search',
                args: context.stepIndex === 1
                  ? { maxResults: 1, query: 'interface' }
                  : repeatedArgs,
              };
            },
          },
        },
      },
      agents: {
        codebaseAgent: defineAgent({
          provider: 'mock',
          instructions: 'Search the codebase once and then produce a finding.',
          tools: [
            defineTool<typeof repeatedArgs>({
              name: 'codebase.search',
              handler(args) {
                handled += 1;
                return {
                  matches: [
                    { path: 'src/index.ts', query: args.query },
                  ],
                };
              },
            }),
          ],
        }),
      },
      harness: defineHarness({
        name: 'codebase-steering',
        phases: [
          { name: 'inspect', toolRefs: ['codebase.search'] },
        ],
        steer: {
          enabled: true,
          maxAttempts: 1,
        },
      }),
    });

    let failure: AgentRunError | undefined;

    try {
      await runAgent({
        deployment,
        projectDir,
        agentName: 'codebaseAgent',
        input: { task: 'Find interface usage' },
        maxSteps: 4,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(AgentRunError);
      failure = err as AgentRunError;
    }

    const expectedMessage = 'Harness steering stopped repeated tool call codebase.search with identical args {"maxResults":1,"query":"interface"}';
    expect(failure?.message).toBe(expectedMessage);
    expect(handled).toBe(1);
    expect(failure?.result.toolCalls.map((call) => call.name)).toEqual(['codebase.search']);
    expect(observedToolResults).toHaveLength(3);
    expect(observedToolResults[2][1]).toMatchObject({
      name: 'codebase.search',
      is_error: true,
      result: {
        error: {
          name: 'HarnessSteering',
          message: expectedMessage,
        },
      },
    });
    expect(failure?.result.trace.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'harness.steer.triggered',
        toolName: 'codebase.search',
        reason: 'repeated_tool_call',
        attempt: 1,
        maxAttempts: 1,
      }),
      expect.objectContaining({
        type: 'harness.steer.blocked',
        toolName: 'codebase.search',
        reason: 'repeated_tool_call',
      }),
    ]));

    const audit = await readAuditLog(projectDir);
    expect(audit.find((entry) => entry.action === 'harness.steer.triggered')).toMatchObject({
      outcome: 'requested',
      toolName: 'codebase.search',
      message: expectedMessage,
    });
    expect(audit.find((entry) => entry.action === 'harness.steer.blocked')).toMatchObject({
      outcome: 'blocked',
      toolName: 'codebase.search',
      message: expectedMessage,
    });
  });

  it('passes tool permission scopes into policy checks', async () => {
    const deployment = createSupportTriageDeployment([
      limitToolScopes({
        allowed: ['ticket:read', 'customer:read'],
        requireScopes: true,
      }),
    ]);
    const projectDir = await mkRunProjectDir();

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
    })).rejects.toThrow('requires ungranted scope(s): issues:write');

    const audit = await readAuditLog(projectDir);
    expect(audit.find((entry) => entry.action === 'policy.blocked')).toMatchObject({
      policy: 'limit-tool-scopes',
      toolName: 'issue.create',
    });
  });

  it('passes deployment environment into policy checks', async () => {
    const deployment = createSupportTriageDeployment([
      restrictEnvironments({
        allowed: ['staging'],
        tools: ['issue.create'],
      }),
    ]);
    const projectDir = await mkRunProjectDir();

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
    })).rejects.toThrow('Policy "restrict-environments" blocked issue.create');

    const audit = await readAuditLog(projectDir);
    expect(audit.find((entry) => entry.policy === 'restrict-environments' && entry.outcome === 'blocked')).toMatchObject({
      outcome: 'blocked',
      toolName: 'issue.create',
    });
  });

  it('enforces first-class governance settings', async () => {
    const deployment = createSupportTriageDeployment();
    deployment.governance = defineGovernance({
      audit: {
        enabled: true,
        retentionDays: 30,
      },
      permissions: {
        requireScopes: true,
        allowedScopes: ['ticket:read', 'customer:read'],
      },
      environments: {
        allowed: ['local', 'staging'],
        tools: ['issue.create'],
      },
      budgets: [
        {
          scope: 'deployment',
          maxUsd: 0.25,
        },
      ],
      dataProtection: {
        denyPII: true,
        redactSecrets: true,
      },
    });
    const projectDir = await mkRunProjectDir();

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
    })).rejects.toThrow('requires ungranted scope(s): issues:write');

    const audit = await readAuditLog(projectDir);
    expect(audit.find((entry) => entry.action === 'policy.blocked')).toMatchObject({
      policy: 'limit-tool-scopes',
      toolName: 'issue.create',
    });
  });

  it('pauses for approval gates, records audit logs, and resumes after approval', async () => {
    const deployment = createSupportTriageDeployment([
      requireApproval({
        tools: ['issue.create'],
        reason: 'Issue creation needs customer approval',
      }),
    ]);
    const projectDir = await mkRunProjectDir();

    const pending = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
    });

    expect(pending.status).toBe('waiting_approval');
    expect(pending.toolCalls.map((call) => call.name)).toEqual(['ticket.get', 'customer.get']);
    // Waiting on a human decision is an approval outcome, not a policy violation.
    expect(pending.policyViolations).toHaveLength(0);
    expect(pending.approvals).toHaveLength(1);
    expect(pending.approvals[0]).toMatchObject({
      status: 'pending',
      policy: 'require-approval',
      toolName: 'issue.create',
      reason: 'Issue creation needs customer approval',
    });

    await approveApproval(projectDir, pending.approvals[0].id, {
      actor: 'fde',
      reason: 'Customer approved issue creation',
    });

    const completed = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1001' },
    });

    expect(completed.status).toBe('completed');
    expect(completed.approvals).toHaveLength(1);
    expect(completed.approvals[0]).toMatchObject({
      id: pending.approvals[0].id,
      status: 'approved',
      decidedBy: 'fde',
    });
    expect(completed.toolCalls.map((call) => call.name)).toEqual([
      'ticket.get',
      'customer.get',
      'issue.create',
      'slack.message',
      'ticket.escalate',
    ]);

    const audit = await readAuditLog(projectDir);
    expect(audit.map((entry) => entry.action)).toEqual(expect.arrayContaining([
      'approval.requested',
      'approval.approved',
      'approval.satisfied',
      'agent.run.completed',
    ]));
    expect(audit.find((entry) => entry.action === 'approval.requested')).toMatchObject({
      approvalId: pending.approvals[0].id,
      actor: 'agent',
    });
  });

  it('validates corrected pending args and requires a fresh approval subject before resume', async () => {
    const projectDir = await mkRunProjectDir();
    let executedArgs: unknown;
    const deployment = defineDeployment({
      name: 'correct-before-approve',
      providers: {
        deterministic: {
          name: 'deterministic',
          runtime: {
            name: 'deterministic',
            planNextStep: (context) => context.toolResults.length === 0
              ? { type: 'tool_call', toolName: 'invoice.adjust', args: { invoiceId: 'inv-1', amount: 100 } }
              : { type: 'final', message: 'Adjustment recorded' },
          },
        },
      },
      agents: {
        operator: defineAgent({
          provider: 'deterministic',
          instructions: 'Adjust the invoice only after approval.',
          policies: [requireApproval({ tools: ['invoice.adjust'] })],
          tools: [defineTool<{ invoiceId: string; amount: number }>({
            name: 'invoice.adjust',
            argsSchema: {
              type: 'object',
              required: ['invoiceId', 'amount'],
              properties: {
                invoiceId: { type: 'string', minLength: 1 },
                amount: { type: 'number', minimum: 1 },
              },
              additionalProperties: false,
            },
            handler(args) {
              executedArgs = args;
              return { adjusted: true };
            },
          })],
        }),
      },
    });
    const paused = await runAgent({ deployment, projectDir, agentName: 'operator', input: {} });
    const original = paused.approvals[0]!;

    await expect(revisePausedApproval({
      deployment,
      projectDir,
      approvalId: original.id,
      args: { invoiceId: 'inv-1', amount: 0 },
      actor: 'reviewer-1',
    })).rejects.toThrow('Replacement args $.amount: Expected number >= 1');

    const revision = await revisePausedApproval({
      deployment,
      projectDir,
      approvalId: original.id,
      args: { invoiceId: 'inv-1', amount: 50 },
      actor: 'reviewer-1',
      reason: 'Correct the amount before approval',
    });
    expect(revision.current).toMatchObject({
      status: 'pending',
      args: { invoiceId: 'inv-1', amount: 50 },
      supersedesId: original.id,
    });
    expect(await readApproval(projectDir, original.id)).toMatchObject({
      status: 'superseded',
      supersededBy: revision.current.id,
    });

    await approveApproval(projectDir, revision.current.id, { actor: 'reviewer-1' });
    const completed = await resumeAgentRun({ deployment, projectDir, runId: paused.id });
    expect(completed.status).toBe('completed');
    expect(executedArgs).toEqual({ invoiceId: 'inv-1', amount: 50 });
  });

  it('redacts secret-like values before writing traces and audit metadata', async () => {
    const deployment = createSupportTriageDeployment();
    const projectDir = await mkRunProjectDir();

    const result = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: {
        ticketId: 'tick_1001',
        token: 'sk-abcdefghijklmnop1234567890',
      },
    });
    const started = result.trace.events.find((event) => event.type === 'agent.run.started');
    const ticketCall = result.trace.events.find((event) => event.type === 'tool.call.completed' && event.toolName === 'ticket.get');
    const audit = await readAuditLog(projectDir);

    expect(JSON.stringify(started)).not.toContain('sk-abcdefghijklmnop1234567890');
    expect(JSON.stringify(ticketCall)).not.toContain('sk-zyxwvutsrqponmlkjihgfedcba');
    expect(JSON.stringify(audit)).not.toContain('sk-abcdefghijklmnop1234567890');
    expect(JSON.stringify(audit)).not.toContain('sk-zyxwvutsrqponmlkjihgfedcba');
  });

  it('keeps runtime strict mode opt-in and blocks incomplete tool metadata when enabled', async () => {
    const deployment = createSupportTriageDeployment();
    const projectDir = await mkRunProjectDir();

    const standard = await runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1002' },
    });

    expect(standard.status).toBe('completed');

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'supportTriage',
      input: { ticketId: 'tick_1002' },
      strict: true,
    })).rejects.toThrow('Tool "ticket.get" must declare argsSchema in strict mode');

    const audit = await readAuditLog(projectDir);
    expect(audit.find((entry) => entry.action === 'runtime.edge.catalog.blocked')).toMatchObject({
      policy: 'runtime-edge',
      outcome: 'blocked',
    });
  });

  it('blocks malformed tool args at the runtime edge before the handler runs', async () => {
    const projectDir = await mkRunProjectDir();
    let handled = false;
    const deployment = defineDeployment({
      name: 'strict-schema-edge',
      environment: 'local',
      providers: {
        mock: {
          name: 'mock',
          options: {
            planner() {
              return {
                type: 'tool_call',
                toolName: 'edge.checked',
                args: {},
              };
            },
          },
        },
      },
      agents: {
        edge: defineAgent({
          provider: 'mock',
          instructions: 'Exercise strict runtime edge gates',
          tools: [
            defineTool<{ ticketId: string }>({
              name: 'edge.checked',
              scopes: ['edge:write'],
              environments: ['local'],
              argsSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                  ticketId: { type: 'string' },
                },
                additionalProperties: false,
              },
              handler() {
                handled = true;
                return { ok: true };
              },
            }),
          ],
        }),
      },
    });

    await expect(runAgent({
      deployment,
      projectDir,
      agentName: 'edge',
      input: {},
      strict: true,
    })).rejects.toThrow('Tool "edge.checked" args $.ticketId: Required property is missing');

    expect(handled).toBe(false);

    const audit = await readAuditLog(projectDir);
    expect(audit.find((entry) => entry.action === 'tool.schema.blocked')).toMatchObject({
      policy: 'tool-schema',
      toolName: 'edge.checked',
      outcome: 'blocked',
    });
  });
});

async function mkRunProjectDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'fdekit-runtime-agent-'));
}

function createSupportTriageDeployment(extraPolicies = []): DeploymentDefinition {
  const tools = createSupportTriageTools();

  return defineDeployment({
    name: 'test-support-triage',
    environment: 'local',
    providers: {
      mock: {
        name: 'mock',
        model: 'support-triage-local',
        options: {
          planner: supportTriageTestPlanner,
        },
      },
    },
    agents: {
      supportTriage: defineAgent({
        provider: 'mock',
        instructions: 'Triage support tickets and escalate risky customer cases',
        tools,
        policies: [
          limitToolUse({ maxCalls: 8 }),
          ...extraPolicies,
        ],
      }),
    },
    policies: [denyPIILeak()],
  });
}

function createSupportTriageTools(): ToolDefinition[] {
  const tickets: Record<string, Record<string, unknown>> = {
    tick_1001: {
      id: 'tick_1001',
      customerId: 'cus_company',
      title: 'Billing issue blocks renewal',
      body: 'The procurement team cannot complete billing before renewal',
      priority: 'high',
      issueType: 'billing',
      tags: ['billing', 'renewal'],
      apiKey: 'sk-zyxwvutsrqponmlkjihgfedcba',
    },
    tick_1002: {
      id: 'tick_1002',
      customerId: 'cus_globex',
      title: 'Question about dashboard filters',
      body: 'The support team needs help with an analytics filter',
      priority: 'normal',
      issueType: 'analytics',
      tags: ['how-to'],
    },
  };
  const customers: Record<string, Record<string, unknown>> = {
    cus_company: {
      id: 'cus_company',
      name: 'company Bank',
      tier: 'enterprise',
      plan: 'enterprise',
    },
    cus_globex: {
      id: 'cus_globex',
      name: 'Globex',
      tier: 'growth',
      plan: 'team',
    },
  };

  return [
    defineTool<{ ticketId: string }>({
      name: 'ticket.get',
      scopes: ['ticket:read'],
      category: 'context',
      tags: ['ticket', 'read'],
      handler(args) {
        return tickets[args.ticketId] ?? null;
      },
    }),
    defineTool<{ customerId: string }>({
      name: 'customer.get',
      scopes: ['customer:read'],
      category: 'context',
      tags: ['customer', 'read'],
      handler(args) {
        return customers[args.customerId] ?? null;
      },
    }),
    defineTool({
      name: 'issue.create',
      scopes: ['issues:write'],
      category: 'issue',
      tags: ['action', 'escalation', 'issue'],
      handler(args) {
        return { id: 'iss_123', ...args };
      },
    }),
    defineTool({
      name: 'slack.message',
      scopes: ['slack:write'],
      category: 'messaging',
      tags: ['action', 'escalation', 'message'],
      handler(args) {
        return { ok: true, ts: '1710000000.000001', ...args };
      },
    }),
    defineTool<{ ticketId: string; reason: string }>({
      name: 'ticket.escalate',
      scopes: ['ticket:write'],
      category: 'escalation',
      tags: ['action', 'escalation', 'ticket'],
      handler(args) {
        return { id: args.ticketId, status: 'escalated', reason: args.reason };
      },
    }),
  ];
}

function supportTriageTestPlanner(context: ProviderPlanContext): ProviderStep {
  const ticketId = getString(context.input.ticketId);

  if (!ticketId) {
    return {
      type: 'final',
      message: 'No ticket id was provided',
    };
  }

  const ticketCall = findToolResult(context.toolResults, 'ticket.get');

  if (!ticketCall) {
    return {
      type: 'tool_call',
      toolName: 'ticket.get',
      args: { ticketId },
    };
  }

  const ticket = asRecord(ticketCall.result);
  const customerId = getString(ticket.customerId);
  const customerCall = findToolResult(context.toolResults, 'customer.get');

  if (customerId && !customerCall) {
    return {
      type: 'tool_call',
      toolName: 'customer.get',
      args: { customerId },
    };
  }

  const customer = customerCall ? asRecord(customerCall.result) : {};
  const triage = classifySupportCase(ticket, customer);

  if (!triage.shouldEscalate) {
    return {
      type: 'final',
      message: `${triage.customerName} ticket ${ticketId} can stay in standard support triage; reason: ${triage.reason}`,
    };
  }

  if (!findToolResult(context.toolResults, 'issue.create')) {
    return {
      type: 'tool_call',
      toolName: 'issue.create',
      args: {
        ticketId,
        title: `[${triage.priority.toUpperCase()}] ${getString(ticket.title) ?? `Support ticket ${ticketId}`}`,
        body: `Customer: ${triage.customerName}\nReason: ${triage.reason}`,
        priority: triage.priority,
      },
    };
  }

  if (!findToolResult(context.toolResults, 'slack.message')) {
    return {
      type: 'tool_call',
      toolName: 'slack.message',
      args: {
        channel: '#support-escalations',
        ticketId,
        text: `${triage.customerName} needs escalation for ${triage.reason}`,
      },
    };
  }

  if (!findToolResult(context.toolResults, 'ticket.escalate')) {
    return {
      type: 'tool_call',
      toolName: 'ticket.escalate',
      args: {
        ticketId,
        reason: triage.reason,
      },
    };
  }

  return {
    type: 'final',
    message: `${triage.customerName} ticket ${ticketId} was escalated as ${triage.priority} priority because ${triage.reason}`,
  };
}

function findToolResult(toolResults: ProviderToolResult[], toolName: string): ProviderToolResult | undefined {
  return toolResults.find((result) => result.name === toolName);
}

function classifySupportCase(ticket: Record<string, unknown>, customer: Record<string, unknown>) {
  const priority = getString(ticket.priority) ?? 'normal';
  const tags = Array.isArray(ticket.tags) ? ticket.tags.map((tag) => String(tag).toLowerCase()) : [];
  const text = `${getString(ticket.title) ?? ''} ${getString(ticket.body) ?? ''} ${tags.join(' ')}`.toLowerCase();
  const tier = getString(customer.tier)?.toLowerCase();
  const shouldEscalate = priority === 'high'
    || tier === 'enterprise'
    || text.includes('billing')
    || text.includes('renewal')
    || text.includes('production')
    || text.includes('outage');
  const reasons = [
    tier === 'enterprise' ? 'enterprise customer' : '',
    text.includes('billing') ? 'billing impact' : '',
    text.includes('renewal') ? 'renewal risk' : '',
    priority === 'high' ? 'high-priority ticket' : '',
  ].filter(Boolean);

  return {
    shouldEscalate,
    priority: shouldEscalate ? 'high' : 'normal',
    customerName: getString(customer.name) ?? 'Unknown customer',
    reason: reasons.join(', ') || 'standard support request',
  };
}

describe('approval review loop', () => {
  function createGatedDeployment(counters: Record<string, number>, connectorMode = 'local'): DeploymentDefinition {
    const countingTool = (name: string, result: Record<string, unknown> = { ok: true }) => defineTool({
      name,
      handler() {
        counters[name] = (counters[name] ?? 0) + 1;
        return { ...result, execution: counters[name] };
      },
    });

    return defineDeployment({
      name: 'test-approval-loop',
      environment: 'local',
      providers: {
        sequential: {
          name: 'sequential',
          runtime: {
            name: 'sequential',
            planNextStep(context) {
              for (const toolName of ['ticket.get', 'issue.create', 'slack.message']) {
                if (!context.toolResults.some((call) => call.name === toolName)) {
                  return {
                    type: 'tool_call',
                    toolName,
                    args: toolName === 'issue.create'
                      ? { title: 'Billing outage blocks renewal', labels: ['billing'] }
                      : { ticketId: 'tick_1001' },
                  };
                }
              }

              return { type: 'final', message: 'Escalation completed with all writes executed' };
            },
          },
        },
      },
      connectors: {
        tracker: defineConnector({
          name: 'tracker',
          config: {
            mode: connectorMode,
            repository: 'company/support-triage',
          },
          tools: [countingTool('issue.create', { issueId: 'ISSUE-1' })],
        }),
      },
      agents: {
        triage: defineAgent({
          provider: 'sequential',
          instructions: 'Escalate the ticket through gated writes',
          tools: [
            countingTool('ticket.get', { id: 'tick_1001' }),
            countingTool('slack.message', { channel: '#alerts' }),
          ],
          policies: [
            requireApproval({ tools: ['issue.create', 'slack.message'], reason: 'External writes need review' }),
          ],
        }),
      },
    });
  }

  it('resumes a paused run without replaying earlier writes and converges', async () => {
    const counters: Record<string, number> = {};
    const deployment = createGatedDeployment(counters);
    const projectDir = await mkRunProjectDir();

    const paused = await runAgent({
      deployment,
      projectDir,
      agentName: 'triage',
      input: { ticketId: 'tick_1001' },
    });

    expect(paused.status).toBe('waiting_approval');
    expect(counters).toEqual({ 'ticket.get': 1 });

    const pausedArtifact = await readJsonArtifact<PausedRunArtifact>(projectDir, 'runs', `${paused.id}.json`);
    expect(pausedArtifact).toMatchObject({
      status: 'paused',
      runId: paused.id,
      agent: 'triage',
      pending: {
        toolName: 'issue.create',
        args: { title: 'Billing outage blocks renewal', labels: ['billing'] },
      },
    });

    await approveApproval(projectDir, paused.approvals[0].id, { actor: 'reviewer' });

    const secondPause = await resumeAgentRun({ deployment, projectDir, agentName: 'triage' });

    expect(secondPause.status).toBe('waiting_approval');
    expect(secondPause.id).toBe(paused.id);
    // The approved write executed exactly once; nothing earlier was replayed.
    expect(counters).toEqual({ 'ticket.get': 1, 'issue.create': 1 });

    const nextApproval = secondPause.approvals.find((approval) => approval.status === 'pending');
    expect(nextApproval?.toolName).toBe('slack.message');
    await approveApproval(projectDir, nextApproval!.id, { actor: 'reviewer' });

    const completed = await resumeAgentRun({ deployment, projectDir, runId: paused.id });

    expect(completed.status).toBe('completed');
    expect(completed.finalAnswer).toBe('Escalation completed with all writes executed');
    expect(counters).toEqual({ 'ticket.get': 1, 'issue.create': 1, 'slack.message': 1 });
    expect(completed.trace.events.filter((event) => event.type === 'agent.run.resumed')).toHaveLength(2);

    const consumed = await readJsonArtifact<PausedRunArtifact>(projectDir, 'runs', `${paused.id}.json`);
    expect(consumed?.status).toBe('consumed');
    await expect(resumeAgentRun({ deployment, projectDir, runId: paused.id })).rejects.toThrow('already resumed');

    const approvals = await readApprovals(projectDir);
    const executed = approvals.find((approval) => approval.toolName === 'issue.create');
    expect(executed).toMatchObject({ status: 'approved', executedRunId: paused.id });
    expect(executed?.executedAt).toBeTruthy();
  });

  it('resumes exact governed tool sequences without provider planning or write replay', async () => {
    const counters: Record<string, number> = {};
    const deployment = createGatedDeployment(counters);
    const projectDir = await mkRunProjectDir();
    const paused = await executeGovernedToolSequence({
      deployment,
      projectDir,
      agentName: 'triage',
      input: { workflow: 'graded-review', reviewId: 'review_1' },
      calls: [
        {
          toolName: 'issue.create',
          args: { title: 'Grounded review finding', labels: ['review'] },
        },
        {
          toolName: 'slack.message',
          args: { channel: '#reviewers', text: 'Review posted' },
        },
      ],
    });

    expect(paused.status).toBe('waiting_approval');
    expect(counters).toEqual({});
    const pausedArtifact = await readJsonArtifact<PausedRunArtifact>(projectDir, 'runs', `${paused.id}.json`);
    expect(pausedArtifact).toMatchObject({
      resumeMode: 'tool_sequence',
      pending: { toolName: 'issue.create' },
      remainingCalls: [{ toolName: 'slack.message' }],
    });

    await approveApproval(projectDir, paused.approvals[0].id, { actor: 'reviewer' });
    const secondPause = await resumeAgentRun({ deployment, projectDir, runId: paused.id });

    expect(secondPause.status).toBe('waiting_approval');
    expect(counters).toEqual({ 'issue.create': 1 });
    const secondApproval = secondPause.approvals.find((approval) => approval.status === 'pending');
    expect(secondApproval?.toolName).toBe('slack.message');

    await approveApproval(projectDir, secondApproval!.id, { actor: 'reviewer' });
    const completed = await resumeAgentRun({ deployment, projectDir, runId: paused.id });

    expect(completed.status).toBe('completed');
    expect(counters).toEqual({ 'issue.create': 1, 'slack.message': 1 });
    expect(JSON.parse(completed.finalAnswer)).toMatchObject({
      mode: 'tool_sequence',
      calls: [
        { name: 'issue.create' },
        { name: 'slack.message' },
      ],
    });
  });

  it('scopes approvals to the connector target so mode flips require fresh review', async () => {
    const counters: Record<string, number> = {};
    const projectDir = await mkRunProjectDir();
    const localDeployment = createGatedDeployment(counters, 'local');

    const paused = await runAgent({
      deployment: localDeployment,
      projectDir,
      agentName: 'triage',
      input: { ticketId: 'tick_1001' },
    });
    const localApproval = paused.approvals[0];
    expect(localApproval.target).toMatchObject({ connector: 'tracker', mode: 'local', repository: 'company/support-triage' });

    await approveApproval(projectDir, localApproval.id, { actor: 'reviewer' });

    // Same deployment, same args, but connectors flipped to live mode: the
    // previously granted approval must not authorize the real write.
    const apiDeployment = createGatedDeployment(counters, 'api');
    const apiRun = await runAgent({
      deployment: apiDeployment,
      projectDir,
      agentName: 'triage',
      input: { ticketId: 'tick_1001' },
    });

    expect(apiRun.status).toBe('waiting_approval');
    const apiApproval = apiRun.approvals.find((approval) => approval.status === 'pending');
    expect(apiApproval?.toolName).toBe('issue.create');
    expect(apiApproval?.id).not.toBe(localApproval.id);
    expect(apiApproval?.target).toMatchObject({ mode: 'api' });
    // The live write never executed without fresh review.
    expect(counters['issue.create']).toBeUndefined();
  });

  it('reports a rejected decision as a distinct run status', async () => {
    const counters: Record<string, number> = {};
    const deployment = createGatedDeployment(counters);
    const projectDir = await mkRunProjectDir();

    const paused = await runAgent({ deployment, projectDir, agentName: 'triage', input: {} });
    await rejectApproval(projectDir, paused.approvals[0].id, { actor: 'reviewer', reason: 'Not during the change freeze' });

    const resumed = await resumeAgentRun({ deployment, projectDir, agentName: 'triage' });
    expect(resumed.status).toBe('rejected');

    const rerun = await runAgent({ deployment, projectDir, agentName: 'triage', input: {} });
    expect(rerun.status).toBe('rejected');
    expect(counters['issue.create']).toBeUndefined();
  });

  it('auto-decides approvals when an override is configured (eval runs)', async () => {
    const counters: Record<string, number> = {};
    const deployment = createGatedDeployment(counters);
    const projectDir = await mkRunProjectDir();

    const approvedRun = await runAgent({
      deployment,
      projectDir,
      agentName: 'triage',
      input: {},
      approvalOverride: { decision: 'approved', actor: 'eval-runner' },
    });

    expect(approvedRun.status).toBe('completed');
    expect(counters).toEqual({ 'ticket.get': 1, 'issue.create': 1, 'slack.message': 1 });
    expect(approvedRun.approvals.every((approval) => approval.decidedBy === 'eval-runner')).toBe(true);
    expect(approvedRun.policyViolations).toHaveLength(0);

    const rejectedProject = await mkRunProjectDir();
    const rejectedCounters: Record<string, number> = {};
    const rejectedRun = await runAgent({
      deployment: createGatedDeployment(rejectedCounters),
      projectDir: rejectedProject,
      agentName: 'triage',
      input: {},
      approvalOverride: { decision: 'rejected', actor: 'eval-runner' },
    });

    expect(rejectedRun.status).toBe('rejected');
    expect(rejectedCounters['issue.create']).toBeUndefined();
  });

  it('keeps decision history and requires force to overturn a decision', async () => {
    const deployment = createGatedDeployment({});
    const projectDir = await mkRunProjectDir();

    const paused = await runAgent({ deployment, projectDir, agentName: 'triage', input: {} });
    const id = paused.approvals[0].id;

    await rejectApproval(projectDir, id, { actor: 'first-reviewer', reason: 'Wrong repository' });

    await expect(approveApproval(projectDir, id, { actor: 'second-reviewer' }))
      .rejects.toBeInstanceOf(ApprovalDecisionConflictError);

    const flipped = await approveApproval(projectDir, id, {
      actor: 'second-reviewer',
      reason: 'Repository fixed',
      force: true,
    });

    expect(flipped.status).toBe('approved');
    expect(flipped.decisions).toHaveLength(2);
    expect(flipped.decisions?.map((decision) => decision.status)).toEqual(['rejected', 'approved']);
    expect(flipped.decisions?.[0]).toMatchObject({ decidedBy: 'first-reviewer', reason: 'Wrong repository' });
  });
});
