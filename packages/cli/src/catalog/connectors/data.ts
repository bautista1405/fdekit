import type { ConnectorManifest } from '../types.js';
import { fdekitDependency } from '../../package-versions.js';

export const dataConnectorManifests: ConnectorManifest[] = [
  {
    kind: 'connector',
    id: 'postgres',
    displayName: 'Postgres',
    packageName: '@fdekit/connector-postgres',
    configFactory: 'postgresConnector()',
    tools: ['postgres.healthCheck', 'postgres.listTables', 'postgres.describeTable', 'postgres.query'],
    maturity: 'Beta',
    supportNote: 'Governance-first SQL validation, schema discovery, query timeouts, optional pooling, and read-only defaults',
    packagePurpose: 'Governed Postgres schema discovery and query execution',
    systemDependency: 'Direct `pg` mode requires the optional peer dependency `pg`, or pass `postgresConnector({ queryClient })`',
    scaffold: {
      key: 'postgres',
      expression: `postgresConnector({
  allowedStatements: ['select', 'with'],
  maxRows: 100,
  queryTimeoutMs: 5_000,
  statementTimeoutMs: 5_000,
  // Add customer-specific governance once tables are known:
  // allowedTables: ['customers', 'tickets'],
  // deniedTables: ['users', 'audit_logs', 'secrets'],
})`,
      imports: [
        { moduleName: '@fdekit/connector-postgres', names: ['postgresConnector'] },
      ],
      dependencies: {
        ...fdekitDependency('@fdekit/connector-postgres'),
        pg: '^8.13.0',
      },
      env: [
        {
          name: 'DATABASE_URL',
          value: 'postgresql://user:password@localhost:5432/app',
          description: 'Postgres connection string for the governed query connector',
        },
      ],
      note: 'Postgres direct mode also adds pg because the connector uses it at runtime unless you inject queryClient',
    },
  },
  {
    kind: 'connector',
    id: 'k6',
    displayName: 'k6 load testing',
    packageName: '@fdekit/connector-k6',
    configFactory: 'k6Connector()',
    tools: ['loadtest.run'],
    maturity: 'Beta',
    supportNote: 'Runs governed load tests through deterministic local mode or a local k6 binary, with VU/duration caps and threshold evidence; real k6 execution requires the Grafana k6 CLI installed separately',
    packagePurpose: 'Governed k6-compatible load-test execution from the agent runtime',
    systemDependency: 'Local mode is deterministic; `k6` mode requires the Grafana k6 CLI on `PATH` or a custom `k6Command`',
    scaffold: {
      key: 'k6',
      expression: `k6Connector({
  mode: process.env.FDEKIT_LOAD_TEST_MODE === 'k6' ? 'k6' : 'local',
  targetUrl: process.env.LOAD_TEST_TARGET_URL ?? 'http://localhost:8000',
  scriptPath: process.env.K6_SCRIPT ?? './load-tests/customer-api-smoke.js',
  k6Command: process.env.K6_BINARY ?? 'k6',
  defaultVus: Number(process.env.K6_DEFAULT_VUS ?? 5),
  defaultDuration: process.env.K6_DEFAULT_DURATION ?? '10s',
  maxVus: Number(process.env.K6_MAX_VUS ?? 50),
  maxDurationSeconds: Number(process.env.K6_MAX_DURATION_SECONDS ?? 300),
})`,
      imports: [
        { moduleName: '@fdekit/connector-k6', names: ['k6Connector'] },
      ],
      dependencies: fdekitDependency('@fdekit/connector-k6'),
      env: [
        {
          name: 'FDEKIT_LOAD_TEST_MODE',
          value: 'local',
          description: 'Use local for deterministic load-test results or k6 to invoke the local k6 binary',
        },
        {
          name: 'LOAD_TEST_TARGET_URL',
          value: 'http://localhost:8000',
          description: 'Customer API base URL for load tests',
        },
        {
          name: 'K6_BINARY',
          value: 'k6',
          description: 'k6 binary path used when FDEKIT_LOAD_TEST_MODE=k6',
        },
        {
          name: 'K6_SCRIPT',
          value: './load-tests/customer-api-smoke.js',
          description: 'k6 JavaScript test file',
        },
      ],
      note: 'k6 mode requires the k6 CLI on PATH; local mode is deterministic and requires no k6 install',
    },
  },
];
