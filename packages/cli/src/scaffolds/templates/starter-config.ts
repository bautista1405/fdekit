import { escapeSingleQuoted } from '../../utils/strings.js';

export function renderStarterConfig(name: string): string {
  return `import {
  defineAgent,
  defineDeployment,
  defineEval,
  defineGovernance,
  maxLatency,
  noPolicyViolation,
  providerFromEnv,
} from '@fdekit/core';

const provider = providerFromEnv();

const supportTriageSmoke = defineEval({
  name: 'support-triage-smoke',
  agent: 'supportTriage',
  dataset: './evals/support-triage.json',
  assertions: [
    noPolicyViolation(),
    maxLatency(10000),
  ],
});

export default defineDeployment({
  name: '${escapeSingleQuoted(name)}',
  version: '0.1.0',
  environment: 'local',
  providers: {
    [provider.name]: provider,
  },
  connectors: {},
  agents: {
    supportTriage: defineAgent({
      provider: provider.name,
      instructions: './agents/support-triage.md',
      tools: [],
      evals: [supportTriageSmoke],
    }),
  },
  governance: defineGovernance({
    audit: {
      enabled: true,
      redactSensitive: true,
    },
    dataProtection: {
      redactSecrets: true,
    },
    budgets: [
      {
        scope: 'deployment',
        maxUsd: 0.25,
      },
    ],
  }),
  evals: [supportTriageSmoke],
});
`;
}
