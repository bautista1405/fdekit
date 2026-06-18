import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { cmdAdd } from '../commands/add.js';
import { cmdDoctor } from '../commands/doctor.js';
import { cmdEnv } from '../commands/env.js';
import { cmdEval } from '../commands/eval.js';
import { cmdInit } from '../commands/init.js';
import { cmdRun } from '../commands/run.js';
import { cmdValidate } from '../commands/validate.js';
import { printCliError } from '../errors.js';
import {
  fdekitCaretDependencyVersion,
  fdekitDependencyVersion,
} from '../package-versions.js';
import {
  captureCommand,
  createCliProject,
  createDoctorProject,
  createEnvironmentProject,
  expectFiles,
  expectTextExcludes,
  expectTextIncludes,
  mkProjectRoot,
  readConfig,
  readEnvExample,
  readPackageJson,
  withEnv,
} from './helpers.js';

vi.setConfig({ testTimeout: 30000 });

describe('cli scaffold and setup commands', () => {
  it('scaffolds a new deployment project', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-init-');
    const output = await captureCommand(() => cmdInit({ cwd, args: ['company-deployment'] }));
    const projectDir = path.join(cwd, 'company-deployment');

    expect(output.exitCode).toBeUndefined();
    expect(output.stdout).toContain('Created FDEKit project company-deployment');
    await expectFiles(projectDir, [
      'fde.config.ts',
      '.env.example',
      'agents/support-triage.md',
      'evals/support-triage.json',
      'workflow.md',
    ]);

    const packageJson = await readPackageJson(projectDir);

    expect(packageJson.scripts?.agent).toContain('fdekit run supportTriage --input');
    expect(packageJson.scripts?.dev).toBe('fdekit dev');
    expect(packageJson.scripts?.doctor).toBe('fdekit doctor');
    expect(packageJson.scripts?.approvals).toBe('fdekit approvals list');
    expect(packageJson.scripts?.audit).toBe('fdekit audit');
    expect(packageJson.scripts?.feedback).toBe('fdekit feedback export');
    expect(packageJson.scripts?.validate).toBe('fdekit validate');
    expect(packageJson.scripts?.['validate:strict']).toBe('fdekit validate --strict');
    expect(packageJson.scripts?.diff).toBe('fdekit diff');
    expect(packageJson.scripts?.eval).toBe('fdekit eval run');
    expect(packageJson.dependencies?.['@fdekit/core']).toBe(fdekitCaretDependencyVersion);
    expect(packageJson.devDependencies?.['@fdekit/cli']).toBe(fdekitCaretDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/provider-openai']).toBeUndefined();
    expect(packageJson.dependencies?.['@fdekit/provider-anthropic']).toBeUndefined();
    expect(packageJson.dependencies?.['@fdekit/provider-google']).toBeUndefined();
    expect(packageJson.dependencies?.['@fdekit/provider-ollama']).toBeUndefined();

    const config = await readConfig(projectDir);
    expectTextIncludes(config, [
      'const provider = providerFromEnv();',
      '[provider.name]: provider',
      'provider: provider.name',
      "name: 'support-triage-smoke'",
      "dataset: './evals/support-triage.json'",
      'defineGovernance',
      'governance: defineGovernance({',
      'connectors: {},',
    ]);
    expectTextExcludes(config, [
      'defaultModels',
      'providerFactories',
      'type ProviderConfig',
      'defineWorkflow',
      'defineHarness',
      'defineOutcomeMetric',
      'defineDataLayers',
      'defineRollout',
      'defineConnector',
      'github: defineConnector',
      'slack: defineConnector',
      'postgres: defineConnector',
    ]);

    const envExample = await readEnvExample(projectDir);
    expectTextIncludes(envExample, [
      'FDEKIT_PROVIDER=mock',
      'FDEKIT_MODEL=',
      'OPENAI_API_KEY=',
      'ANTHROPIC_API_KEY=',
      'GEMINI_API_KEY=',
      'OLLAMA_BASE_URL=http://127.0.0.1:11434',
    ]);
    expectTextExcludes(envExample, [
      'OPENAI_MODEL=',
      'ANTHROPIC_MODEL=',
      'OLLAMA_MODEL=',
      'GITHUB_TOKEN=',
      'SLACK_BOT_TOKEN=',
      'DATABASE_URL=',
    ]);

    const validateOutput = await captureCommand(() => cmdValidate({
      cwd: projectDir,
      args: [],
    }));

    expect(validateOutput.exitCode).toBeUndefined();
    expect(validateOutput.stdout).not.toContain('Connector does not expose any tools yet');
    expect(validateOutput.stdout).not.toContain('connectors.github.tools');
    expect(validateOutput.stdout).not.toContain('connectors.slack.tools');
    expect(validateOutput.stdout).not.toContain('connectors.postgres.tools');
  });


  it('selects starter project providers from .env without checking unused provider credentials', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-provider-env-');
    await captureCommand(() => cmdInit({ cwd, args: ['provider-demo'] }));
    const projectDir = path.join(cwd, 'provider-demo');
    const envPath = path.join(projectDir, '.env');

    await withEnv({
      FDEKIT_MODEL: undefined,
      FDEKIT_PROVIDER: undefined,
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      GEMINI_API_KEY: undefined,
      OLLAMA_BASE_URL: undefined,
    }, async () => {
      await writeFile(envPath, 'FDEKIT_PROVIDER=mock\n', 'utf8');
      const mockOutput = await captureCommand(() => cmdDoctor({ cwd: projectDir, args: [] }));
      expect(mockOutput.exitCode).toBeUndefined();
      expect(mockOutput.stdout).toContain('  mock');
      expect(mockOutput.stdout).not.toContain('OPENAI_API_KEY');
      expect(mockOutput.stdout).not.toContain('ANTHROPIC_API_KEY');

      await writeFile(envPath, [
        'FDEKIT_PROVIDER=localOllama',
        'FDEKIT_MODEL=hermes3:8b',
        'OLLAMA_BASE_URL=http://127.0.0.1:11434',
        '',
      ].join('\n'), 'utf8');
      const localOutput = await captureCommand(() => cmdDoctor({ cwd: projectDir, args: [] }));
      expect(localOutput.exitCode).toBeUndefined();
      expect(localOutput.stdout).toContain('  localOllama');
      expect(localOutput.stdout).toContain('OLLAMA_BASE_URL');
      expect(localOutput.stdout).toContain('FDEKIT_MODEL');
      expect(localOutput.stdout).not.toContain('OPENAI_API_KEY');

      await writeFile(envPath, 'FDEKIT_PROVIDER=openai\nFDEKIT_MODEL=gpt-5.5\n', 'utf8');
      const missingOpenAI = await captureCommand(() => cmdDoctor({ cwd: projectDir, args: [] }));
      expect(missingOpenAI.exitCode).toBe(1);
      expect(missingOpenAI.stdout).toContain('  openai');
      expect(missingOpenAI.stdout).toContain('OPENAI_API_KEY');
      expect(missingOpenAI.stdout).not.toContain('ANTHROPIC_API_KEY');
      expect(missingOpenAI.stdout).not.toContain('GEMINI_API_KEY');

      await writeFile(envPath, [
        'FDEKIT_PROVIDER=anthropic',
        'ANTHROPIC_API_KEY=sk-ant-test',
        'FDEKIT_MODEL=claude-opus-4-8',
        '',
      ].join('\n'), 'utf8');
      const anthropicOutput = await captureCommand(() => cmdDoctor({ cwd: projectDir, args: [] }));
      expect(anthropicOutput.exitCode).toBeUndefined();
      expect(anthropicOutput.stdout).toContain('  anthropic');
      expect(anthropicOutput.stdout).toContain('ANTHROPIC_API_KEY');
      expect(anthropicOutput.stdout).not.toContain('OPENAI_API_KEY');

      await writeFile(envPath, [
        'FDEKIT_PROVIDER=google',
        'GEMINI_API_KEY=gemini-test',
        'FDEKIT_MODEL=gemini-3.5-flash',
        '',
      ].join('\n'), 'utf8');
      const googleOutput = await captureCommand(() => cmdDoctor({ cwd: projectDir, args: [] }));
      expect(googleOutput.exitCode).toBeUndefined();
      expect(googleOutput.stdout).toContain('  google');
      expect(googleOutput.stdout).toContain('GEMINI_API_KEY');
      expect(googleOutput.stdout).not.toContain('OPENAI_API_KEY');
      expect(googleOutput.stdout).not.toContain('ANTHROPIC_API_KEY');
    });
  });

  it('adds providers and policies to an existing config', async () => {
    const projectDir = await createCliProject();

    const providerOutput = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['provider', 'anthropic'],
    }));
    const localProviderOutput = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['provider', 'localOllama'],
    }));
    const googleProviderOutput = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['provider', 'google'],
    }));
    const policyOutput = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['policy', 'limit-cost'],
    }));

    expect(providerOutput.stdout).toContain('Added provider anthropic');
    expect(localProviderOutput.stdout).toContain('Added provider localOllama');
    expect(googleProviderOutput.stdout).toContain('Added provider google');
    expect(localProviderOutput.stdout).toContain('Run `ollama pull llama3.1:8b`');
    expect(policyOutput.stdout).toContain('Added policy limit-cost');

    const config = await readConfig(projectDir);
    expectTextIncludes(config, [
      "import { anthropicProvider } from '@fdekit/provider-anthropic';",
      "import { googleProvider } from '@fdekit/provider-google';",
      "import { localOllamaProvider } from '@fdekit/provider-ollama';",
      "anthropic: anthropicProvider({ model: process.env.FDEKIT_MODEL || 'claude-opus-4-8' })",
      "google: googleProvider({ model: process.env.FDEKIT_MODEL || 'gemini-3.5-flash' })",
      'localOllama: localOllamaProvider({',
      'model: process.env.FDEKIT_MODEL || \'llama3.1:8b\'',
      'apiBaseUrl: process.env.OLLAMA_BASE_URL',
      'limitCost',
      'limitCost({ maxUsd: 0.25 })',
    ]);

    const scopesOutput = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['policy', 'limit-tool-scopes'],
    }));
    expect(scopesOutput.stdout).toContain('Added policy limit-tool-scopes');
    expect(await readConfig(projectDir)).toContain('limitToolScopes');

    const packageJson = await readPackageJson(projectDir);
    expect(packageJson.dependencies?.['@fdekit/provider-anthropic']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/provider-google']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/provider-ollama']).toBe(fdekitDependencyVersion);

    expectTextIncludes(await readEnvExample(projectDir), [
      'ANTHROPIC_API_KEY=',
      'GEMINI_API_KEY=',
      'OLLAMA_BASE_URL=',
      'FDEKIT_MODEL=llama3.1:8b',
    ]);
  });


  it('scaffolds known connectors with imports, dependencies, and env docs', async () => {
    const projectDir = await createCliProject();

    const postgresOutput = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['connector', 'postgres'],
    }));
    const linearOutput = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['connector', 'linear'],
    }));
    const hubspotOutput = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['connector', 'hubspot'],
    }));
    const codebaseOutput = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['connector', 'codebase'],
    }));
    const k6Output = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['connector', 'k6'],
    }));
    const customOutput = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['connector', 'internal-crm'],
    }));
    const salesforceProjectDir = await createCliProject();
    const salesforceOutput = await captureCommand(() => cmdAdd({
      cwd: salesforceProjectDir,
      args: ['connector', 'salesforce'],
    }));

    expect(postgresOutput.stdout).toContain('Added connector postgres');
    expect(postgresOutput.stdout).toContain('Updated package.json, .env.example');
    expect(postgresOutput.stdout).toContain('Postgres direct mode also adds pg');
    expect(linearOutput.stdout).toContain('Added connector linear');
    expect(hubspotOutput.stdout).toContain('Added connector hubspot');
    expect(salesforceOutput.stdout).toContain('Added connector salesforce');
    expect(codebaseOutput.stdout).toContain('Added connector codebase');
    expect(k6Output.stdout).toContain('Added connector k6');
    expect(k6Output.stdout).toContain('k6 mode requires the k6 CLI');
    expect(customOutput.stdout).toContain('Added connector internal-crm');

    const config = await readConfig(projectDir);
    expectTextIncludes(config, [
      "import { postgresConnector } from '@fdekit/connector-postgres';",
      "import { linearConnector } from '@fdekit/connector-linear';",
      "import { hubspotConnector } from '@fdekit/connector-hubspot';",
      "import { codebaseConnector } from '@fdekit/connector-codebase';",
      "import { k6Connector } from '@fdekit/connector-k6';",
      "postgres: postgresConnector({",
      "allowedStatements: ['select', 'with']",
      "linear: linearConnector({",
      "hubspot: hubspotConnector({",
      "codebase: codebaseConnector({",
      "k6: k6Connector({",
      "rootDir: process.env.CODEBASE_ROOT ?? '.'",
      "mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local'",
      '"internal-crm": defineConnector({ name: \'internal-crm\' })',
    ]);

    const salesforceConfig = await readConfig(salesforceProjectDir);
    expectTextIncludes(salesforceConfig, [
      "import { salesforceConnector } from '@fdekit/connector-salesforce';",
      "salesforce: salesforceConnector({",
      "mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local'",
    ]);

    const packageJson = await readPackageJson(projectDir);
    expect(packageJson.dependencies?.['@fdekit/connector-postgres']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/connector-linear']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/connector-hubspot']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/connector-codebase']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/connector-k6']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.pg).toBe('^8.13.0');

    const salesforcePackageJson = await readPackageJson(salesforceProjectDir);
    expect(salesforcePackageJson.dependencies?.['@fdekit/connector-salesforce']).toBe(fdekitDependencyVersion);

    const envExample = await readEnvExample(projectDir);
    expectTextIncludes(envExample, [
      'DATABASE_URL=postgresql://user:password@localhost:5432/app',
      'FDEKIT_CONNECTOR_MODE=local',
      'CODEBASE_ROOT=.',
      'LINEAR_API_KEY=',
      'LINEAR_TEAM_ID=',
      'HUBSPOT_ACCESS_TOKEN=',
      'FDEKIT_LOAD_TEST_MODE=local',
      'LOAD_TEST_TARGET_URL=http://localhost:8000',
      'K6_SCRIPT=./load-tests/customer-api-smoke.js',
    ]);
    expect(envExample.match(/^FDEKIT_CONNECTOR_MODE=/gm)).toHaveLength(1);

    const salesforceEnvExample = await readEnvExample(salesforceProjectDir);
    expectTextIncludes(salesforceEnvExample, [
      'SALESFORCE_INSTANCE_URL=https://your-domain.my.salesforce.com',
      'SALESFORCE_ACCESS_TOKEN=',
      'SALESFORCE_API_VERSION=v60.0',
    ]);
    expect(salesforceEnvExample.match(/^FDEKIT_CONNECTOR_MODE=/gm)).toHaveLength(1);
  });

  it('blocks known connector tool name collisions before mutating config', async () => {
    const issueProjectDir = await createCliProject();
    await captureCommand(() => cmdAdd({
      cwd: issueProjectDir,
      args: ['connector', 'github'],
    }));
    const issueConfigBeforeCollision = await readConfig(issueProjectDir);
    const issuePackageBeforeCollision = await readPackageJson(issueProjectDir);

    const jiraOutput = await captureAddCommand(issueProjectDir, ['connector', 'jira']);

    expect(jiraOutput.exitCode).toBe(1);
    expect(jiraOutput.stderr).toContain('Error: Connector jira would duplicate tool issue.create from connector github');
    expect(jiraOutput.stderr).toContain('Next: For issue trackers, prefer one backend at a time');
    expect(await readConfig(issueProjectDir)).toBe(issueConfigBeforeCollision);
    expect(await readPackageJson(issueProjectDir)).toEqual(issuePackageBeforeCollision);

    const crmProjectDir = await createCliProject();
    await captureCommand(() => cmdAdd({
      cwd: crmProjectDir,
      args: ['connector', 'hubspot'],
    }));
    const crmConfigBeforeCollision = await readConfig(crmProjectDir);
    const crmPackageBeforeCollision = await readPackageJson(crmProjectDir);

    const salesforceOutput = await captureAddCommand(crmProjectDir, ['connector', 'salesforce']);

    expect(salesforceOutput.exitCode).toBe(1);
    expect(salesforceOutput.stderr).toContain('Error: Connector salesforce would duplicate tool crm.note.create from connector hubspot');
    expect(salesforceOutput.stderr).toContain('Next: For CRM notes, prefer one backend at a time');
    expect(await readConfig(crmProjectDir)).toBe(crmConfigBeforeCollision);
    expect(await readPackageJson(crmProjectDir)).toEqual(crmPackageBeforeCollision);
  });

  it('validates directly added connector tools without environment warnings', async () => {
    const connectorNames = [
      'customer-api',
      'codebase',
      'slack',
      'github',
      'jira',
      'linear',
      'postgres',
      'k6',
      'hubspot',
      'salesforce',
    ];

    for (const connectorName of connectorNames) {
      const projectDir = await createMinimalAddProject();

      await captureCommand(() => cmdAdd({
        cwd: projectDir,
        args: ['connector', connectorName],
      }));
      const validateOutput = await captureCommand(() => cmdValidate({
        cwd: projectDir,
        args: [],
      }));

      expect(validateOutput.exitCode).toBeUndefined();
      expect(validateOutput.stdout).toContain('No validation issues found');
      expect(validateOutput.stdout).not.toContain('Tool does not declare allowed environments');
    }
  });

  it('does not duplicate connectors that are already configured', async () => {
    const projectDir = await createCliProject();

    const firstPostgres = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['connector', 'postgres'],
    }));
    const duplicatePostgres = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['connector', 'postgres'],
    }));
    const firstCustom = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['connector', 'internal-crm'],
    }));
    const duplicateCustom = await captureCommand(() => cmdAdd({
      cwd: projectDir,
      args: ['connector', 'internal-crm'],
    }));

    expect(firstPostgres.stdout).toContain('Added connector postgres');
    expect(duplicatePostgres.stdout).toContain('Connector postgres is already configured');
    expect(firstCustom.stdout).toContain('Added connector internal-crm');
    expect(duplicateCustom.stdout).toContain('Connector internal-crm is already configured');

    const config = await readConfig(projectDir);
    expect(config.match(/^    postgres:/gm)).toHaveLength(1);
    expect(config.match(/^    "internal-crm":/gm)).toHaveLength(1);

    const packageJson = await readPackageJson(projectDir);
    expect(packageJson.dependencies?.['@fdekit/connector-postgres']).toBe(fdekitDependencyVersion);
  });


  it('sets a non-zero exit code for invalid command usage', async () => {
    const runOutput = await captureCommand(() => cmdRun({ cwd: process.cwd(), args: [] }));
    const evalOutput = await captureCommand(() => cmdEval({ cwd: process.cwd(), args: [] }));

    expect(runOutput.exitCode).toBe(1);
    expect(runOutput.stderr).toContain('Usage: fdekit run');
    expect(evalOutput.exitCode).toBe(1);
    expect(evalOutput.stderr).toContain('Usage: fdekit eval <run|macro>');
  });


  it('checks provider and connector env setup with doctor', async () => {
    const projectDir = await createDoctorProject();

    const missing = await withEnv({
      OPENAI_API_KEY: undefined,
      GITHUB_TOKEN: undefined,
      GITHUB_REPOSITORY: undefined,
      CUSTOMER_API_URL: undefined,
    }, () => captureCommand(() => cmdDoctor({ cwd: projectDir, args: [] })));

    expect(missing.exitCode).toBe(1);
    expect(missing.stdout).toContain('FDEKit doctor');
    expect(missing.stdout).toContain('Deployment: doctor-test-deployment');
    expect(missing.stdout).toContain('OPENAI_API_KEY');
    expect(missing.stdout).toContain('GITHUB_TOKEN');
    expect(missing.stdout).toContain('GITHUB_REPOSITORY');
    expect(missing.stdout).toContain('CUSTOMER_API_URL');
    expect(missing.stdout).toContain('optional');
    expect(missing.stdout).toContain('Summary: 3 missing required env var(s)');

    const ready = await withEnv({
      OPENAI_API_KEY: 'sk-test',
      GITHUB_TOKEN: 'ghp_test',
      GITHUB_REPOSITORY: 'company/app',
      CUSTOMER_API_URL: undefined,
    }, () => captureCommand(() => cmdDoctor({ cwd: projectDir, args: [] })));

    expect(ready.exitCode).toBeUndefined();
    expect(ready.stdout).toContain('OPENAI_API_KEY');
    expect(ready.stdout).toContain('set');
    expect(ready.stdout).toContain('Summary: all required env vars are set');

    const live = await withEnv({
      OPENAI_API_KEY: 'sk-test',
      GITHUB_TOKEN: 'ghp_test',
      GITHUB_REPOSITORY: 'company/app',
      CUSTOMER_API_URL: undefined,
    }, () => captureCommand(() => cmdDoctor({ cwd: projectDir, args: ['--live'] })));

    expect(live.exitCode).toBeUndefined();
    expect(live.stdout).toContain('Live Checks');
    expect(live.stdout).toContain('customerApi customerApi.healthCheck ok');
    expect(live.stdout).toContain('postgres postgres.healthCheck ok');
    expect(live.stdout).toContain('Summary: all required env vars are set');
  });


  it('describes and doctors configured runtime environments', async () => {
    const projectDir = await createEnvironmentProject();

    const describe = await captureCommand(() => cmdEnv({ cwd: projectDir, args: ['describe'] }));
    expect(describe.exitCode).toBeUndefined();
    expect(describe.stdout).toContain('FDEKit env describe');
    expect(describe.stdout).toContain('Environment: local-floci-test');
    expect(describe.stdout).toContain('customer-api: http://localhost:8787');
    expect(describe.stdout).toContain('Start commands');
    expect(describe.stdout).toContain('floci.start: node -e');

    const doctor = await captureCommand(() => cmdEnv({ cwd: projectDir, args: ['doctor'] }));
    expect(doctor.exitCode).toBeUndefined();
    expect(doctor.stdout).toContain('FDEKit env doctor');
    expect(doctor.stdout).toContain('Environment: local-floci-test');
    expect(doctor.stdout).toContain('No environment health checks configured');
  });

});

async function captureAddCommand(projectDir: string, args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: string | number | undefined;
}> {
  return captureCommand(async () => {
    try {
      await cmdAdd({ cwd: projectDir, args });
    } catch (err) {
      printCliError(err);
      process.exitCode = 1;
    }
  });
}

async function createMinimalAddProject(): Promise<string> {
  const projectDir = await mkProjectRoot('fdekit-cli-add-validate-');

  await mkdir(path.join(projectDir, 'agents'), { recursive: true });
  await writeFile(path.join(projectDir, 'agents', 'agent.md'), 'Connector metadata smoke test', 'utf8');
  await writeFile(path.join(projectDir, 'fde.config.ts'), `import {
  defineAgent,
  defineDeployment,
} from '@fdekit/core';

export default defineDeployment({
  name: 'add-connector-validation',
  environment: 'local',
  providers: {
    mock: { name: 'mock' },
  },
  connectors: {},
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
