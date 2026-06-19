import { defineConnector, defineTool, type ConnectorDefinition } from '@fdekit/core';
import {
  buildK6Command,
  commandResultToK6Result,
  createRuntimeConfig,
  localK6Result,
  normalizeRunArgs,
  runK6,
} from './helpers/index.js';
import type { K6ConnectorConfig, K6ConnectorMode, K6ConnectorOptions, K6RunArgs, K6RunResult, K6Scenario } from './interfaces/index.js';
export type { K6CommandInvocation, K6CommandResult, K6ConnectorConfig, K6ConnectorMode, K6ConnectorOptions, K6RunArgs, K6RunEvidenceKind, K6RunResult, K6Scenario } from './interfaces/index.js';

const k6RunArgsSchema = {
  type: 'object',
  properties: {
    scenario: {
      type: 'string',
      description: 'Load-test scenario name, such as smoke, baseline, stress, or spike',
    },
    targetUrl: {
      type: 'string',
      description: 'Customer API base URL to test',
    },
    scriptPath: {
      type: 'string',
      description: 'Path to the k6 JavaScript test file',
    },
    vus: {
      type: 'number',
      description: 'Virtual users for this run',
    },
    duration: {
      type: 'string',
      description: 'k6 duration such as 30s or 2m',
    },
    summaryPath: {
      type: 'string',
      description: 'Path where the k6 script can write a JSON summary',
    },
    tags: {
      type: 'object',
      description: 'Optional run tags for scenario/customer/build metadata',
    },
  },
};

export function k6Connector(options: K6ConnectorOptions = {}): ConnectorDefinition<K6ConnectorConfig> {
  const config = createRuntimeConfig(options);
  const now = options.now ?? (() => new Date().toISOString());

  return defineConnector({
    name: 'k6',
    description: 'Run governed API load-test scenarios; local mode simulates deterministic metrics without HTTP, while k6 mode invokes the k6 CLI',
    config,
    env: [
      {
        name: config.targetUrlEnv,
        required: false,
        description: 'Target API base URL for load tests',
      },
      ...(config.mode === 'k6'
        ? [{
          name: 'K6_BINARY',
          required: false,
          description: 'Optional k6 binary path when not using the default k6 command',
        }]
        : []),
    ],
    tools: [
      defineTool<K6RunArgs, K6RunResult>({
        name: 'loadtest.run',
        description: 'Run a governed load-test scenario; local mode returns a simulation without making HTTP requests, while k6 mode returns measured results',
        scopes: ['loadtest:run'],
        environments: ['local', 'staging'],
        category: 'load-test',
        tags: ['action', 'load-test'],
        argsSchema: k6RunArgsSchema,
        async handler(args) {
          const normalized = normalizeRunArgs(args, config);

          if (config.mode === 'local') {
            return localK6Result(normalized, config, now);
          }

          const command = buildK6Command(normalized, config);
          const result = await runK6(command, options.runCommand);

          return commandResultToK6Result(normalized, config, command, result, now);
        },
      }),
    ],
  });
}
