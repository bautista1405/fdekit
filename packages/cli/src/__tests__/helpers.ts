import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { expect } from 'vitest';

export interface PackageJson {
  type?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function createCliProject(options: { requireIssueApproval?: boolean } = {}): Promise<string> {
  const projectDir = await mkProjectRoot('fdekit-cli-project-');
  await mkdir(path.join(projectDir, 'agents'), { recursive: true });
  await mkdir(path.join(projectDir, 'evals'), { recursive: true });
  await writeFile(
    path.join(projectDir, 'agents', 'support-triage.md'),
    'Triage support tickets and escalate enterprise billing or renewal risk',
    'utf8',
  );
  await writeFile(
    path.join(projectDir, 'evals', 'support-triage.json'),
    `${JSON.stringify([
      {
        name: 'enterprise billing escalation',
        input: { ticketId: 'tick_1001' },
        expected: {
          escalation: true,
          customerId: 'cus_company',
          priority: 'high',
          issueType: 'billing',
        },
      },
      {
        name: 'standard support triage',
        input: { ticketId: 'tick_1002' },
        expected: {
          escalation: false,
          customerId: 'cus_globex',
          priority: 'normal',
        },
      },
    ], null, 2)}\n`,
    'utf8',
  );
  await writeFile(path.join(projectDir, 'fde.config.ts'), renderConfig(options), 'utf8');

  return projectDir;
}

export async function createDoctorProject(): Promise<string> {
  const projectDir = await mkProjectRoot('fdekit-cli-doctor-');
  await mkdir(path.join(projectDir, 'agents'), { recursive: true });
await writeFile(path.join(projectDir, 'agents', 'agent.md'), 'Test agent', 'utf8');
  await writeFile(path.join(projectDir, 'fde.config.ts'), `import {
  defineAgent,
  defineConnector,
  defineDeployment,
  defineTool,
} from '@fdekit/core';

export default defineDeployment({
  name: 'doctor-test-deployment',
  environment: 'local',
  providers: {
    openai: {
      name: 'openai',
      apiKeyEnv: 'OPENAI_API_KEY',
    },
  },
  connectors: {
    github: defineConnector({
      name: 'github',
      config: { mode: 'api' },
      env: [
        { name: 'GITHUB_TOKEN', required: true, description: 'GitHub token' },
        { name: 'GITHUB_REPOSITORY', required: true, description: 'GitHub owner/repo' },
      ],
    }),
    customerApi: defineConnector({
      name: 'customer-api',
      config: { baseUrl: process.env.CUSTOMER_API_URL ?? 'http://127.0.0.1:8787' },
      env: [
        { name: 'CUSTOMER_API_URL', required: false, description: 'Override local API URL' },
      ],
      tools: [
        defineTool({
          name: 'customerApi.healthCheck',
          handler() {
            return { ok: true, latencyMs: 1 };
          },
        }),
      ],
    }),
    postgres: defineConnector({
      name: 'postgres',
      config: { mode: 'client' },
      tools: [
        defineTool({
          name: 'postgres.healthCheck',
          handler() {
            return { ok: true, latencyMs: 1 };
          },
        }),
      ],
    }),
  },
  agents: {
    supportTriage: defineAgent({
      provider: 'openai',
      instructions: './agents/agent.md',
    }),
  },
});
`, 'utf8');

  return projectDir;
}

export async function createEnvironmentProject(): Promise<string> {
  const projectDir = await mkProjectRoot('fdekit-cli-env-');
  await mkdir(path.join(projectDir, 'agents'), { recursive: true });
  await writeFile(path.join(projectDir, 'agents', 'agent.md'), 'Test agent', 'utf8');
  await writeFile(path.join(projectDir, 'fde.config.ts'), `import {
  defineAgent,
  defineDeployment,
} from '@fdekit/core';

export default defineDeployment({
  name: 'environment-test-deployment',
  environment: 'local',
  runtimeEnvironment: {
    name: 'local-floci-test',
    kind: 'local-floci',
    commands: {
      start: [
        {
          name: 'floci.start',
          command: 'node -e "process.exit(0)"',
          description: 'Start Floci',
        },
      ],
    },
    healthChecks: [],
    evidence: {
      kind: 'local-floci',
      name: 'local-floci-test',
      endpoints: [
        { name: 'customer-api', url: 'http://localhost:8787' },
      ],
      services: [
        { name: 'customer-api', kind: 'customer-api', replicas: 2, endpoint: 'http://localhost:8787' },
      ],
    },
  },
  providers: {
    mock: { name: 'mock' },
  },
  agents: {
    worker: defineAgent({
      provider: 'mock',
      instructions: './agents/agent.md',
    }),
  },
});
`, 'utf8');

  return projectDir;
}

export async function readConfig(projectDir: string): Promise<string> {
  return readFile(path.join(projectDir, 'fde.config.ts'), 'utf8');
}

export async function readEnvExample(projectDir: string): Promise<string> {
  return readFile(path.join(projectDir, '.env.example'), 'utf8');
}

export async function readPackageJson(projectDir: string): Promise<PackageJson> {
  return JSON.parse(await readFile(path.join(projectDir, 'package.json'), 'utf8')) as PackageJson;
}

export async function expectFiles(projectDir: string, relativePaths: string[]): Promise<void> {
  for (const relativePath of relativePaths) {
    await expect(fileExists(path.join(projectDir, relativePath))).resolves.toBe(true);
  }
}

export function expectTextIncludes(text: string, fragments: string[]): void {
  for (const fragment of fragments) {
    expect(text).toContain(fragment);
  }
}

export function expectTextExcludes(text: string, fragments: string[]): void {
  for (const fragment of fragments) {
    expect(text).not.toContain(fragment);
  }
}

function renderConfig(options: { requireIssueApproval?: boolean } = {}): string {
  return `import {
  asRecord,
  defineAgent,
  defineDeployment,
  defineEval,
  defineTool,
  expectedToolCall,
  getString,
  noPolicyViolation,
  ${options.requireIssueApproval ? 'requireApproval,' : ''}
  type ProviderPlanContext,
  type ProviderStep,
  type ProviderToolResult,
} from '@fdekit/core';

const tickets = {
  tick_1001: {
    id: 'tick_1001',
    customerId: 'cus_company',
    title: 'Billing issue blocks renewal',
    body: 'The procurement team cannot complete billing before renewal',
    priority: 'high',
    issueType: 'billing',
    tags: ['billing', 'renewal'],
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

const customers = {
  cus_company: {
    id: 'cus_company',
    name: 'company Bank',
    tier: 'enterprise',
  },
  cus_globex: {
    id: 'cus_globex',
    name: 'Globex',
    tier: 'growth',
  },
};

function supportTriageMockPlanner(context: ProviderPlanContext): ProviderStep {
  const ticketId = getString(context.input.ticketId);

  if (!ticketId) {
    return { type: 'final', message: 'No ticket id was provided' };
  }

  const ticketCall = findToolResult(context.toolResults, 'ticket.get');

  if (!ticketCall) {
    return { type: 'tool_call', toolName: 'ticket.get', args: { ticketId } };
  }

  const ticket = asRecord(ticketCall.result);
  const customerId = getString(ticket.customerId);
  const customerCall = findToolResult(context.toolResults, 'customer.get');

  if (customerId && !customerCall) {
    return { type: 'tool_call', toolName: 'customer.get', args: { customerId } };
  }

  const customer = customerCall ? asRecord(customerCall.result) : {};
  const triage = classifySupportCase(ticket, customer);

  if (!triage.shouldEscalate) {
    return {
      type: 'final',
      message: \`\${triage.customerName} ticket \${ticketId} can stay in standard support triage; reason: \${triage.reason}\`,
    };
  }

  if (!findToolResult(context.toolResults, 'issue.create')) {
    return {
      type: 'tool_call',
      toolName: 'issue.create',
      args: {
        ticketId,
        title: \`[\${triage.priority.toUpperCase()}] \${getString(ticket.title) ?? \`Support ticket \${ticketId}\`}\`,
        body: \`Customer: \${triage.customerName}\\nReason: \${triage.reason}\`,
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
        text: \`\${triage.customerName} needs escalation for \${triage.reason}\`,
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
    message: \`\${triage.customerName} ticket \${ticketId} was escalated as \${triage.priority} priority because \${triage.reason}\`,
  };
}

function findToolResult(toolResults: ProviderToolResult[], toolName: string): ProviderToolResult | undefined {
  return toolResults.find((result) => result.name === toolName);
}

function classifySupportCase(ticket: Record<string, unknown>, customer: Record<string, unknown>) {
  const priority = getString(ticket.priority) ?? 'normal';
  const tags = Array.isArray(ticket.tags) ? ticket.tags.map((tag) => String(tag).toLowerCase()) : [];
  const text = \`\${getString(ticket.title) ?? ''} \${getString(ticket.body) ?? ''} \${tags.join(' ')}\`.toLowerCase();
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

export default defineDeployment({
  name: 'cli-test-deployment',
  environment: 'local',
  providers: {
    mock: {
      name: 'mock',
      options: {
        planner: supportTriageMockPlanner,
      },
    },
  },
  ${options.requireIssueApproval ? "policies: [requireApproval({ tools: ['issue.create'], reason: 'Issue creation needs FDE approval' })]," : ''}
  agents: {
    supportTriage: defineAgent({
      provider: 'mock',
      instructions: './agents/support-triage.md',
      tools: [
        defineTool({
          name: 'ticket.get',
          category: 'context',
          tags: ['ticket', 'read'],
          handler(args) {
            return tickets[args.ticketId] ?? null;
          },
        }),
        defineTool({
          name: 'customer.get',
          category: 'context',
          tags: ['customer', 'read'],
          handler(args) {
            return customers[args.customerId] ?? null;
          },
        }),
        defineTool({
          name: 'issue.create',
          category: 'issue',
          tags: ['action', 'escalation', 'issue'],
          handler(args) {
            return { id: 'iss_123', ...args };
          },
        }),
        defineTool({
          name: 'slack.message',
          category: 'messaging',
          tags: ['action', 'escalation', 'message'],
          handler(args) {
            return { ok: true, ts: '1710000000.000001', ...args };
          },
        }),
        defineTool({
          name: 'ticket.escalate',
          category: 'escalation',
          tags: ['action', 'escalation', 'ticket'],
          handler(args) {
            return { id: args.ticketId, status: 'escalated', reason: args.reason };
          },
        }),
      ],
    }),
  },
  evals: [
    defineEval({
      name: 'support-triage-dataset',
      agent: 'supportTriage',
      dataset: './evals/support-triage.json',
      maxSteps: 8,
      assertions: [
        expectedToolCall('ticket.get'),
        expectedToolCall('customer.get'),
        noPolicyViolation(),
      ],
    }),
  ],
});
`;
}

export async function mkProjectRoot(prefix: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonDir(dir: string): Promise<unknown[]> {
  const entries = await readdir(dir);
  return Promise.all(entries
    .filter((entry) => entry.endsWith('.json'))
    .sort()
    .map(async (entry) => JSON.parse(await readFile(path.join(dir, entry), 'utf8')) as unknown));
}

export async function captureCommand(run: () => Promise<void>): Promise<{
  stdout: string;
  stderr: string;
  exitCode: string | number | undefined;
}> {
  const logs: string[] = [];
  const errors: string[] = [];
  const previousLog = console.log;
  const previousError = console.error;
  const previousExitCode = process.exitCode;

  process.exitCode = undefined;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };

  try {
    await run();

    return {
      stdout: logs.join('\n'),
      stderr: errors.join('\n'),
      exitCode: process.exitCode,
    };
  } finally {
    console.log = previousLog;
    console.error = previousError;
    process.exitCode = previousExitCode;
  }
}

export async function withEnv<T>(
  values: Record<string, string | undefined>,
  run: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const key of Object.keys(values)) {
    previous.set(key, process.env[key]);

    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
