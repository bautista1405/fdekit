import {
  renderConfigTemplate,
  renderDeploymentHeader,
  renderEvalSetup,
  renderImportBlock,
  renderRecipeMetadata,
  renderRecipeModulePath,
  renderRuntimeSettings,
} from '../../config-renderers.js';
import type { RecipeContext } from '../../../registry.js';

export function renderSalesResearchConfig(ctx: RecipeContext): string {
  return renderConfigTemplate([
    importsBlock(ctx),
    mockPlannerSetup(),
    runtimeSettings(),
    connectorSetup(),
    evalSetup(),
    deploymentBlock(ctx.projectName),
    localTypesAndReaders(),
  ]);
}

function importsBlock(ctx: RecipeContext): string {
  return `${renderImportBlock({
    node: [
      { moduleName: 'fs', names: ['readFileSync'] },
      { moduleName: 'path', names: ['resolve'] },
      { moduleName: 'url', names: ['fileURLToPath'] },
    ],
    core: [
      'asRecord',
      'defineAgent',
      'defineConnector',
      'defineDataLayers',
      'defineDeployment',
      'defineEval',
      'defineGovernance',
      'defineHarness',
      'defineOutcomeMetric',
      'defineRollout',
      'defineTool',
      'defineWorkflow',
      'expectedFinalAnswer',
      'expectedToolCall',
      'limitToolUse',
      'maxCost',
      'maxLatency',
      'noPolicyViolation',
      'getString',
      'pick',
      'type ProviderConfig',
    ],
    packages: [
      { moduleName: '@fdekit/connector-hubspot', names: ['hubspotConnector'] },
      { moduleName: '@fdekit/connector-salesforce', names: ['salesforceConnector'] },
      { moduleName: '@fdekit/provider-google', names: ['googleProvider'] },
    ],
  })}import { createSalesResearchMockPlanner } from '${renderRecipeModulePath(ctx, 'mock-planner.mjs')}';

`;
}

function mockPlannerSetup(): string {
  return `const salesResearchMockPlanner = createSalesResearchMockPlanner();

`;
}

function runtimeSettings(): string {
  return `${renderRuntimeSettings({
    mockModel: 'sales-research-local',
    types: [
      "type ConnectorMode = 'local' | 'api';",
      "type CrmChoice = 'local' | 'hubspot' | 'salesforce';",
    ],
    beforeSettings: "const crm = pick(process.env.FDEKIT_CRM, ['local', 'hubspot', 'salesforce'], 'local');\nconst connectorMode: ConnectorMode = process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local';\n\n",
    settings: [
      {
        name: 'crm',
        type: 'CrmChoice',
        expression: 'crm',
      },
      {
        name: 'connectorMode',
        type: 'ConnectorMode',
        expression: 'connectorMode',
      },
      {
        name: 'datasetPath',
        type: 'string',
        expression: "process.env.SALES_RESEARCH_DATASET ?? './sales-data/prospects.json'",
      },
    ],
  })}
const projectDir = fileURLToPath(new URL('../..', import.meta.url));
const salesData = readSalesResearchData(settings.datasetPath);

const providerFactories = {
  mock: () => ({
    name: 'mock',
    model: settings.model,
    options: {
      planner: salesResearchMockPlanner,
    },
  }),
  localOllama: () => ({
    name: 'localOllama',
    model: settings.model,
    env: [
      {
        name: 'OLLAMA_BASE_URL',
        required: false,
        description: 'Optional Ollama server URL; defaults to http://127.0.0.1:11434',
      },
      {
        name: 'FDEKIT_MODEL',
        required: false,
        description: 'Optional model override for the selected provider',
      },
    ],
    options: {
      apiBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
      format: 'json',
      keepAlive: '5m',
      numPredict: 900,
      temperature: 0,
    },
  }),
  openai: () => ({
    name: 'openai',
    model: settings.model,
    apiKeyEnv: 'OPENAI_API_KEY',
    env: [
      {
        name: 'OPENAI_API_KEY',
        required: true,
        description: 'OpenAI API key used by the runtime provider adapter',
      },
    ],
    options: {
      maxOutputTokens: 900,
    },
  }),
  anthropic: () => ({
    name: 'anthropic',
    model: settings.model,
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    env: [
      {
        name: 'ANTHROPIC_API_KEY',
        required: true,
        description: 'Anthropic API key used by the runtime provider adapter',
      },
    ],
    options: {
      anthropicVersion: '2023-06-01',
      maxTokens: 900,
    },
  }),
  google: () => googleProvider({
    model: settings.model,
    maxOutputTokens: 900,
  }),
} satisfies Record<ProviderChoice, () => ProviderConfig>;

const providers = {
  [settings.provider]: providerFactories[settings.provider](),
};

`;
}

function connectorSetup(): string {
  return `const salesResearch = defineConnector({
  name: 'sales-research',
  description: 'Local sales research and CRM-style tools for account planning',
  env: [
    {
      name: 'SALES_RESEARCH_DATASET',
      required: false,
      description: 'Path to a local CRM/research export JSON file',
    },
  ],
  tools: [
    defineTool({
      name: 'sales.account.lookup',
      description: 'Look up an account by accountId, domain, or companyName',
      scopes: ['sales:read'],
      environments: ['local', 'development', 'staging'],
      category: 'sales',
      tags: ['context', 'sales', 'read'],
      handler(args) {
        const input = asRecord(args);
        const accountId = getString(input.accountId);
        const domain = getString(input.domain)?.toLowerCase();
        const companyName = getString(input.companyName)?.toLowerCase();
        const account = salesData.accounts.find((candidate) => {
          return candidate.id === accountId
            || candidate.domain.toLowerCase() === domain
            || candidate.name.toLowerCase() === companyName;
        });

        return account ?? null;
      },
    }),
    defineTool({
      name: 'sales.contacts.find',
      description: 'Find likely buyer, champion, or technical evaluator contacts for an account',
      scopes: ['contact:read'],
      environments: ['local', 'development', 'staging'],
      category: 'sales',
      tags: ['context', 'contacts', 'read'],
      handler(args) {
        const input = asRecord(args);
        const accountId = getString(input.accountId);
        const persona = getString(input.persona)?.toLowerCase();
        const contacts = salesData.contacts
          .filter((contact) => contact.accountId === accountId)
          .filter((contact) => !persona || contact.personas.some((candidate) => candidate.toLowerCase().includes(persona) || persona.includes(candidate.toLowerCase())));

        return {
          accountId,
          contacts: contacts.length > 0 ? contacts : salesData.contacts.filter((contact) => contact.accountId === accountId),
        };
      },
    }),
    defineTool({
      name: 'sales.intent.lookup',
      description: 'Load recent buying signals, initiatives, and timing for an account',
      scopes: ['intent:read'],
      environments: ['local', 'development', 'staging'],
      category: 'sales',
      tags: ['context', 'intent', 'read'],
      handler(args) {
        const accountId = getString(asRecord(args).accountId);

        return {
          accountId,
          signals: salesData.intentSignals.filter((signal) => signal.accountId === accountId),
        };
      },
    }),
  ],
});

const localCrm = defineConnector({
  name: 'local-crm',
  description: 'Local CRM note sink for credential-free sales research demos',
  tools: [
    defineTool({
      name: 'crm.note.create',
      description: 'Create a CRM note with the account research brief and recommended next step',
      scopes: ['crm:write'],
      environments: ['local', 'development', 'staging'],
      category: 'crm',
      tags: ['action', 'crm-handoff', 'crm'],
      handler(args) {
        const input = asRecord(args);

        return {
          id: \`note_\${getString(input.accountId) ?? 'account'}_\${Date.now()}\`,
          createdAt: new Date().toISOString(),
          ...input,
        };
      },
    }),
  ],
});

const crmConnectors = {
  local: localCrm,
  hubspot: hubspotConnector({
    mode: settings.connectorMode,
    accessTokenEnv: 'HUBSPOT_ACCESS_TOKEN',
    portalId: process.env.HUBSPOT_PORTAL_ID,
  }),
  salesforce: salesforceConnector({
    mode: settings.connectorMode,
    instanceUrl: process.env.SALESFORCE_INSTANCE_URL,
    defaultWhatId: process.env.SALESFORCE_ACCOUNT_ID,
  }),
} satisfies Record<CrmChoice, ReturnType<typeof defineConnector>>;
`;
}

function evalSetup(): string {
  return renderEvalSetup({
    toolLimit: {
      constName: 'salesResearchToolLimit',
      expression: 'limitToolUse({ maxCalls: 6 })',
    },
    evalConst: 'salesResearchEval',
    name: 'sales-research-dataset',
    agent: 'salesResearchAgent',
    dataset: './evals/sales-research-agent.json',
    maxSteps: 6,
    assertions: [
      "expectedToolCall('sales.account.lookup')",
      "expectedToolCall('sales.contacts.find')",
      "expectedToolCall('sales.intent.lookup')",
      "expectedToolCall('crm.note.create')",
      'expectedFinalAnswer(/sales research|company Cloud|cloud cost/i)',
      'noPolicyViolation()',
      'maxLatency(10000)',
      'maxCost(0.25)',
    ],
  });
}

function deploymentBlock(projectName: string): string {
  return `${renderDeploymentHeader(projectName, 'sales-research')}${renderRecipeMetadata('sales-research-agent', [
    'Review SALES_RESEARCH_DATASET shape before pointing at customer CRM exports',
    'Run fdekit validate after switching CRM backends or enabling API connector mode',
  ])}  // Runtime uses providers, connectors, agents, governance, evals, harness, and artifacts.
  // Workflow/outcomeMetrics/dataLayers/rollout are field-method narrative for reports and recipe handoff.
  environment: 'local',
  workflow: defineWorkflow({
    name: 'Sales account research and CRM handoff',
    owner: 'revenue-operations',
    currentState: {
      summary: 'Account executives and sales ops manually gather account, contact, and intent context before writing CRM notes',
      handoffs: ['account-executive', 'sales-engineering', 'revenue-operations'],
      baseline: {
        cycleTime: '45m manual account research',
        manualSteps: 8,
      },
    },
    targetState: {
      summary: 'The agent gathers account, buyer, and intent context, then creates a governed CRM note with a recommended next step',
      target: '<10m account brief with CRM note and next action',
      evidence: ['account summary', 'buyer contacts', 'intent signals', 'CRM note', 'eval/audit record'],
    },
    scorecard: {
      volume: 'high',
      manualEffort: 'high',
      fragmentedSystems: ['crm export', 'hubspot', 'salesforce', 'intent signals'],
      repeatableDecisions: 'high',
      measurablePain: ['research-cycle-time', 'crm-hygiene', 'pipeline-follow-up-delay'],
      riskBoundary: 'CRM writes remain approval-gated before production; account strategy stays human-owned',
    },
  }),
  outcomeMetrics: [
    defineOutcomeMetric({
      name: 'research-cycle-time',
      baseline: '45m manual research',
      target: '<10m account brief',
    }),
    defineOutcomeMetric({
      name: 'crm-hygiene',
      baseline: 'inconsistent note quality',
      target: 'all notes include context, angle, and next step',
    }),
  ],
  dataLayers: defineDataLayers({
    systemOfRecord: ['CRM account records', 'CRM contacts', 'intent signal sources'],
    businessRules: ['./agents/sales-research-agent.md', 'governance policies', 'eval assertions'],
    rawIntake: ['accountId', 'persona', 'sales-data/prospects.json'],
    feedback: ['.fdekit/approvals', '.fdekit/audit', '.fdekit/evals'],
  }),
  rollout: defineRollout({
    stage: 'local',
    stages: ['local', 'sandbox', 'customer-sample', 'shadow', 'approved-write', 'production-allowlist'],
    next: 'Replace the bundled sales dataset with a customer CRM export before enabling HubSpot or Salesforce API mode',
  }),
  harness: defineHarness({
    name: 'sales-research-handoff-harness',
    description: 'Research, qualification, CRM write, and review phases for sales account workflows',
    maxSteps: 8,
    phases: [
      {
        name: 'account-context',
        description: 'Load account, contact, and intent context from the selected CRM/research source',
        toolRefs: ['sales.account.lookup', 'sales.contacts.find', 'sales.intent.lookup'],
        artifactRefs: ['trace', 'research-brief'],
        maxSteps: 3,
      },
      {
        name: 'qualification',
        description: 'Turn research into a buyer hypothesis and recommended next action',
        policyRefs: ['deny-pii-leak', 'redact-secrets', 'limit-cost'],
        evalRefs: [salesResearchEval],
        artifactRefs: ['buyer-hypothesis'],
        maxSteps: 2,
      },
      {
        name: 'crm-handoff',
        description: 'Create the CRM note only after the account brief has enough evidence',
        toolRefs: ['crm.note.create'],
        policyRefs: ['limit-tool-scopes', 'restrict-environments', salesResearchToolLimit],
        artifactRefs: ['crm-note', 'audit'],
        maxSteps: 2,
      },
      {
        name: 'review',
        description: 'Run evals and package the customer-facing handoff',
        evalRefs: [salesResearchEval],
        artifactRefs: ['eval', 'report', 'dashboard'],
        maxSteps: 1,
      },
    ],
    toolRefs: ['sales.account.lookup', 'sales.contacts.find', 'sales.intent.lookup', 'crm.note.create'],
    policyRefs: ['deny-pii-leak', 'redact-secrets', 'limit-tool-scopes', 'restrict-environments', 'limit-cost', salesResearchToolLimit],
    evalRefs: [salesResearchEval],
    artifactRefs: ['trace', 'research-brief', 'crm-note', 'audit', 'eval', 'report', 'dashboard'],
    review: {
      evalRefs: [salesResearchEval],
      artifactRefs: ['report', 'dashboard'],
    },
    steer: {
      enabled: true,
      maxAttempts: 1,
      triggerRefs: [salesResearchEval, 'deny-pii-leak', 'limit-cost'],
    },
  }),
  metadata: {
    businessImpact: {
      workflow: 'Sales account research and CRM handoff',
      estimatedMinutesSaved: 35,
    },
  },
  providers,
  connectors: {
    salesResearch,
    crm: crmConnectors[settings.crm],
  },
  governance: defineGovernance({
    audit: {
      enabled: true,
      retentionDays: 30,
      redactSensitive: true,
    },
    dataProtection: {
      denyPII: true,
      redactSecrets: true,
    },
    permissions: {
      scopes: [
        { name: 'sales:read', description: 'Read account and sales research records', risk: 'low' },
        { name: 'contact:read', description: 'Read CRM contact records', risk: 'medium' },
        { name: 'intent:read', description: 'Read buying intent signals', risk: 'low' },
        { name: 'crm:write', description: 'Write CRM notes and handoff summaries', risk: 'high' },
      ],
      grants: [
        {
          agent: 'salesResearchAgent',
          scopes: ['sales:read', 'contact:read', 'intent:read', 'crm:write'],
        },
      ],
      requireScopes: true,
    },
    environments: {
      allowed: ['local', 'development', 'staging'],
      tools: ['crm.note.create'],
    },
    budgets: [
      {
        scope: 'deployment',
        maxUsd: 0.25,
      },
    ],
  }),
  agents: {
    salesResearchAgent: defineAgent({
      provider: settings.provider,
      instructions: './agents/sales-research-agent.md',
      policies: [
        salesResearchToolLimit,
      ],
    }),
  },
  evals: [
    salesResearchEval,
  ],
});

function readSalesResearchData(filePath: string): SalesResearchData {
  const raw = JSON.parse(readFileSync(resolve(projectDir, filePath), 'utf8')) as SalesResearchData;

  return {
    accounts: raw.accounts ?? [],
    contacts: raw.contacts ?? [],
    intentSignals: raw.intentSignals ?? [],
  };
}

`;
}

function localTypesAndReaders(): string {
  return `interface SalesResearchData {
  accounts: AccountRecord[];
  contacts: ContactRecord[];
  intentSignals: IntentSignalRecord[];
}

interface AccountRecord {
  id: string;
  name: string;
  domain: string;
  segment: string;
  industry: string;
  employeeCount: number;
  currentStack: string[];
  priorities: string[];
  painPoints: string[];
  recommendedAngle: string;
}

interface ContactRecord {
  id: string;
  accountId: string;
  name: string;
  title: string;
  personas: string[];
  publicContext: string;
}

interface IntentSignalRecord {
  id: string;
  accountId: string;
  source: string;
  summary: string;
  confidence: 'low' | 'medium' | 'high';
}
`;
}
