import type { ConnectorManifest } from '../types.js';
import { fdekitDependency } from '../../package-versions.js';

export const workspaceConnectorManifests: ConnectorManifest[] = [
  {
    kind: 'connector',
    id: 'customer-api',
    displayName: 'Customer API',
    packageName: '@fdekit/connector-customer-api',
    configFactory: 'customerApiConnector()',
    tools: ['ticket.get', 'customer.get', 'ticket.escalate'],
    maturity: 'Ready',
    supportNote: 'Default support-triage connector for customer-owned HTTP APIs and custom adapter patterns',
    packagePurpose: 'Customer, ticket, and escalation tools for support deployments',
    systemDependency: 'Local mode is deterministic; API mode uses the configured customer API URL',
    scaffold: {
      key: 'customerApi',
      expression: `customerApiConnector({
  baseUrl: process.env.CUSTOMER_API_URL ?? 'http://127.0.0.1:8787',
})`,
      imports: [
        { moduleName: '@fdekit/connector-customer-api', names: ['customerApiConnector'] },
      ],
      dependencies: fdekitDependency('@fdekit/connector-customer-api'),
      env: [
        {
          name: 'CUSTOMER_API_URL',
          value: 'http://127.0.0.1:8787',
          description: 'Customer API base URL; replace with the customer-owned API in real deployments',
        },
      ],
    },
  },
  {
    kind: 'connector',
    id: 'codebase',
    displayName: 'Codebase',
    packageName: '@fdekit/connector-codebase',
    configFactory: 'codebaseConnector()',
    tools: ['codebase.search', 'codebase.readFile'],
    maturity: 'Ready',
    supportNote: 'Local repository search and file reads for codebase-agent workflows',
    packagePurpose: 'Local repository listing, search, and file reads',
    systemDependency: 'Set `CODEBASE_ROOT` to the local repository root',
    scaffold: {
      key: 'codebase',
      expression: `codebaseConnector({
  rootDir: process.env.CODEBASE_ROOT ?? '.',
})`,
      imports: [
        { moduleName: '@fdekit/connector-codebase', names: ['codebaseConnector'] },
      ],
      dependencies: fdekitDependency('@fdekit/connector-codebase'),
      env: [
        {
          name: 'CODEBASE_ROOT',
          value: '.',
          description: 'Local repository root for codebase tools',
        },
      ],
    },
  },
];
