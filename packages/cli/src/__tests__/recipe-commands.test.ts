import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { cmdDoctor } from '../commands/doctor.js';
import { cmdEval } from '../commands/eval.js';
import { cmdInit } from '../commands/init.js';
import { cmdRecipe } from '../commands/recipe.js';
import { cmdRun } from '../commands/run.js';
import { cmdValidate } from '../commands/validate.js';
import {
  fdekitCaretDependencyVersion,
  fdekitDependencyVersion,
} from '../package-versions.js';
import {
  captureCommand,
  expectFiles,
  expectTextExcludes,
  expectTextIncludes,
  mkProjectRoot,
  readConfig,
  readEnvExample,
  readPackageJson,
} from './helpers.js';

vi.setConfig({ testTimeout: 30000 });

describe('cli recipe commands', () => {
  it('installs the support-triage recipe as a runnable laddered scaffold', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-recipe-');
    await captureCommand(() => cmdInit({ cwd, args: ['recipe-app'] }));
    const projectDir = path.join(cwd, 'recipe-app');

    const output = await captureCommand(() => cmdRecipe({
      cwd: projectDir,
      args: ['install', 'support-triage'],
    }));

    expect(output.exitCode).toBeUndefined();
    expect(output.stdout).toContain('Installed recipe support-triage');
    expect(output.stdout).toContain('Config updated:');
    expect(output.stdout).toContain('Next: npm install && npm run demo');
    await expectFiles(projectDir, [
      'customer-api/server.js',
      'customer-api/data/seed.json',
      'recipes/support-triage/README.md',
      'recipes/support-triage/workflow.md',
      'recipes/support-triage/mock-planner.mjs',
      'scripts/demo.mjs',
    ]);

    const config = await readConfig(projectDir);
    expectTextIncludes(config, [
      '@fdekit/connector-customer-api',
      '@fdekit/connector-github',
      '@fdekit/connector-slack',
      './recipes/support-triage/mock-planner.mjs',
      "provider: 'mock'",
      'defineGovernance',
      "workflow: defineWorkflow({",
      "harness: defineHarness({",
      "defineOutcomeMetric({",
      "scorecard: {",
      "dataLayers: defineDataLayers({",
      "rollout: defineRollout({",
      "allowedScopes: ['customer:read', 'ticket:read', 'ticket:write', 'issues:write', 'slack:write']",
      'support-triage-dataset',
    ]);

    const evals = JSON.parse(await readFile(path.join(projectDir, 'evals', 'support-triage.json'), 'utf8')) as unknown[];
    expect(evals).toHaveLength(2);

    const packageJson = await readPackageJson(projectDir);
    expect(packageJson.scripts?.api).toBe('node customer-api/server.js');
    expect(packageJson.scripts?.demo).toBe('node scripts/demo.mjs');
    expect(packageJson.scripts?.['fdekit:run']).toBe('fdekit run supportTriage --ticket tick_1001');
    expect(packageJson.scripts?.['fdekit:approvals']).toBe('fdekit approvals list');
    expect(packageJson.scripts?.['fdekit:audit']).toBe('fdekit audit');
    expect(packageJson.scripts?.['fdekit:feedback']).toBe('fdekit feedback export');
    expect(packageJson.scripts?.['fdekit:validate']).toBe('fdekit validate');
    expect(packageJson.scripts?.['fdekit:validate:strict']).toBe('fdekit validate --strict');
    expect(packageJson.scripts?.['fdekit:diff']).toBe('fdekit diff');
    expect(packageJson.scripts?.['fdekit:console']).toBe('fdekit console');
    expect(packageJson.dependencies?.['@fdekit/connector-customer-api']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/connector-github']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/connector-slack']).toBe(fdekitDependencyVersion);
    expect(packageJson.devDependencies?.['@fdekit/cli']).toBe(fdekitDependencyVersion);
  });


  it('installs the codebase-agent recipe with a customer-codebase escape hatch', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-codebase-recipe-');
    await captureCommand(() => cmdInit({ cwd, args: ['codebase-app'] }));
    const projectDir = path.join(cwd, 'codebase-app');

    const output = await captureCommand(() => cmdRecipe({
      cwd: projectDir,
      args: ['install', 'codebase-agent'],
    }));

    expect(output.exitCode).toBeUndefined();
    expect(output.stdout).toContain('Installed recipe codebase-agent');
    expect(output.stdout).toContain('Config updated:');
    await expectFiles(projectDir, [
      'sample-repo/src/billing.ts',
      'recipes/codebase-agent/README.md',
      'recipes/codebase-agent/workflow.md',
      'recipes/codebase-agent/mock-planner.mjs',
      'scripts/demo.mjs',
    ]);

    const config = await readConfig(projectDir);
    expectTextIncludes(config, [
      '@fdekit/connector-codebase',
      '@fdekit/connector-github',
      '@fdekit/connector-jira',
      '@fdekit/connector-linear',
      '@fdekit/provider-openai',
      '@fdekit/provider-anthropic',
      '@fdekit/provider-google',
      '@fdekit/provider-ollama',
      './recipes/codebase-agent/mock-planner.mjs',
      "const provider = pick(process.env.FDEKIT_PROVIDER, ['mock', 'localOllama', 'openai', 'anthropic', 'google'], 'mock')",
      'model: process.env.FDEKIT_MODEL || defaultModels[provider]',
      'rootDir: settings.codebaseRoot',
      'const providerFactories = {',
      'const issueTrackers = {',
      'defineGovernance',
      "workflow: defineWorkflow({",
      "harness: defineHarness({",
      "defineOutcomeMetric({",
      "scorecard: {",
      "dataLayers: defineDataLayers({",
      "rollout: defineRollout({",
      "allowedScopes: ['codebase:read', 'issues:write']",
      'codebaseAgent',
      'codebase-agent-dataset',
    ]);

    const envExample = await readEnvExample(projectDir);
    expectTextIncludes(envExample, [
      'FDEKIT_PROVIDER=mock',
      'FDEKIT_MODEL=',
      'CODEBASE_ROOT=./sample-repo',
      'set to . when installing inside a customer repo',
      'OLLAMA_BASE_URL=',
      'OPENAI_API_KEY=',
      'ANTHROPIC_API_KEY=',
      'GEMINI_API_KEY=',
      'FDEKIT_ISSUE_TRACKER=github',
      'GITHUB_REPOSITORY=owner/repo',
      'JIRA_PROJECT_KEY=ENG',
      'LINEAR_TEAM_ID=',
    ]);
    expectTextExcludes(envExample, [
      'OLLAMA_MODEL=',
      'OPENAI_MODEL=',
      'ANTHROPIC_MODEL=',
    ]);

    const packageJson = await readPackageJson(projectDir);
    expect(packageJson.scripts?.demo).toBe('node scripts/demo.mjs');
    expect(packageJson.scripts?.['fdekit:codebase:run']).toContain('fdekit run codebaseAgent');
    expect(packageJson.scripts?.['fdekit:codebase:approvals']).toBe('fdekit approvals list');
    expect(packageJson.scripts?.['fdekit:codebase:audit']).toBe('fdekit audit');
    expect(packageJson.scripts?.['fdekit:codebase:feedback']).toBe('fdekit feedback export');
    expect(packageJson.scripts?.['fdekit:codebase:validate']).toBe('fdekit validate');
    expect(packageJson.scripts?.['fdekit:codebase:validate:strict']).toBe('fdekit validate --strict');
    expect(packageJson.scripts?.['fdekit:codebase:diff']).toBe('fdekit diff');
    expect(packageJson.dependencies?.['@fdekit/connector-codebase']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/connector-github']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/connector-jira']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/connector-linear']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/provider-openai']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/provider-anthropic']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/provider-google']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/provider-ollama']).toBe(fdekitDependencyVersion);
    expect(packageJson.devDependencies?.['@fdekit/cli']).toBe(fdekitDependencyVersion);
  });


  it('installs and runs the sales-research-agent recipe as a laddered CRM scaffold', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-sales-recipe-');
    await captureCommand(() => cmdInit({ cwd, args: ['sales-app'] }));
    const projectDir = path.join(cwd, 'sales-app');

    const output = await captureCommand(() => cmdRecipe({
      cwd: projectDir,
      args: ['install', 'sales-research-agent'],
    }));

    expect(output.exitCode).toBeUndefined();
    expect(output.stdout).toContain('Installed recipe sales-research-agent');
    expect(output.stdout).toContain('Config updated:');
    await expectFiles(projectDir, [
      'sales-data/prospects.json',
      'recipes/sales-research-agent/README.md',
      'recipes/sales-research-agent/workflow.md',
      'recipes/sales-research-agent/mock-planner.mjs',
      'scripts/demo.mjs',
    ]);

    const config = await readConfig(projectDir);
    expectTextIncludes(config, [
      'sales.account.lookup',
      'sales.contacts.find',
      'sales.intent.lookup',
      'crm.note.create',
      '@fdekit/connector-hubspot',
      '@fdekit/connector-salesforce',
      './recipes/sales-research-agent/mock-planner.mjs',
      "const crm = pick(process.env.FDEKIT_CRM, ['local', 'hubspot', 'salesforce'], 'local')",
      'hubspotConnector({',
      'salesforceConnector({',
      "const provider = pick(process.env.FDEKIT_PROVIDER, ['mock', 'localOllama', 'openai', 'anthropic', 'google'], 'mock')",
      'model: process.env.FDEKIT_MODEL || defaultModels[provider]',
      'SALES_RESEARCH_DATASET',
      'defineGovernance',
      "workflow: defineWorkflow({",
      "harness: defineHarness({",
      "defineOutcomeMetric({",
      "scorecard: {",
      "dataLayers: defineDataLayers({",
      "rollout: defineRollout({",
      "scopes: ['sales:read', 'contact:read', 'intent:read', 'crm:write']",
      'salesResearchAgent',
      'sales-research-dataset',
    ]);

    const envExample = await readEnvExample(projectDir);
    expectTextIncludes(envExample, [
      'FDEKIT_PROVIDER=mock',
      'FDEKIT_MODEL=',
      'FDEKIT_CRM=local',
      'FDEKIT_CONNECTOR_MODE=local',
      'SALES_RESEARCH_DATASET=./sales-data/prospects.json',
      'HUBSPOT_ACCESS_TOKEN=',
      'SALESFORCE_INSTANCE_URL=https://your-domain.my.salesforce.com',
      'SALESFORCE_ACCESS_TOKEN=',
      'OPENAI_API_KEY=',
      'ANTHROPIC_API_KEY=',
      'GEMINI_API_KEY=',
    ]);
    expectTextExcludes(envExample, [
      'OPENAI_MODEL=',
      'ANTHROPIC_MODEL=',
      'OLLAMA_MODEL=',
    ]);

    const packageJson = await readPackageJson(projectDir);
    expect(packageJson.scripts?.demo).toBe('node scripts/demo.mjs');
    expect(packageJson.scripts?.['fdekit:sales:run']).toContain('fdekit run salesResearchAgent');
    expect(packageJson.scripts?.['fdekit:sales:validate']).toBe('fdekit validate');
    expect(packageJson.scripts?.['fdekit:sales:feedback']).toBe('fdekit feedback export');
    expect(packageJson.scripts?.['fdekit:sales:validate:strict']).toBe('fdekit validate --strict');
    expect(packageJson.scripts?.['fdekit:sales:diff']).toBe('fdekit diff');
    expect(packageJson.scripts?.['fdekit:sales:console']).toBe('fdekit console');
    expect(packageJson.dependencies?.['@fdekit/core']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/connector-hubspot']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/connector-salesforce']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/provider-google']).toBe(fdekitDependencyVersion);
    expect(packageJson.devDependencies?.['@fdekit/cli']).toBe(fdekitDependencyVersion);

    const doctorOutput = await captureCommand(() => cmdDoctor({ cwd: projectDir, args: [] }));
    expect(doctorOutput.exitCode).toBeUndefined();
    expect(doctorOutput.stdout).toContain('sales-research');
    expect(doctorOutput.stdout).toContain('SALES_RESEARCH_DATASET');

    const runOutput = await captureCommand(() => cmdRun({
      cwd: projectDir,
      args: ['salesResearchAgent', '--input', '{"accountId":"acct_company","persona":"CRO"}'],
    }));

    expect(runOutput.exitCode).toBeUndefined();
    expect(runOutput.stdout).toContain('Agent: salesResearchAgent');
    expect(runOutput.stdout).toContain('Tool calls: sales.account.lookup, sales.contacts.find, sales.intent.lookup, crm.note.create');
    expect(runOutput.stdout).toContain('Final answer: company Cloud sales research is ready');

    const evalOutput = await captureCommand(() => cmdEval({ cwd: projectDir, args: ['run'] }));
    expect(evalOutput.exitCode).toBeUndefined();
    expect(evalOutput.stdout).toContain('Eval status: passed');
  });


  it('installs and runs the load-test-agent recipe as a governed k6 scaffold', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-loadtest-recipe-');
    await captureCommand(() => cmdInit({ cwd, args: ['loadtest-app'] }));
    const projectDir = path.join(cwd, 'loadtest-app');

    const output = await captureCommand(() => cmdRecipe({
      cwd: projectDir,
      args: ['install', 'load-test-agent'],
    }));

    expect(output.exitCode).toBeUndefined();
    expect(output.stdout).toContain('Installed recipe load-test-agent');
    expect(output.stdout).toContain('Config updated:');
    await expectFiles(projectDir, [
      'load-tests/customer-api-smoke.js',
      'customer-api/server.js',
      'recipes/load-test-agent/README.md',
      'recipes/load-test-agent/workflow.md',
      'recipes/load-test-agent/mock-planner.mjs',
      'scripts/demo.mjs',
    ]);

    const config = await readConfig(projectDir);
    expectTextIncludes(config, [
      '@fdekit/connector-k6',
      './recipes/load-test-agent/mock-planner.mjs',
      'k6Connector({',
      'loadtest.run',
      "workflow: defineWorkflow({",
      "harness: defineHarness({",
      "defineOutcomeMetric({",
      "scorecard: {",
      "dataLayers: defineDataLayers({",
      "rollout: defineRollout({",
      "allowedScopes: ['loadtest:run']",
      "environments: {",
      "tools: ['loadtest.run']",
      "limitToolUse({ tools: ['loadtest.run'], maxCalls: 1 })",
      'loadTestAgent',
      'load-test-smoke',
    ]);

    expectTextIncludes(await readEnvExample(projectDir), [
      'FDEKIT_LOAD_TEST_MODE=local',
      'LOAD_TEST_TARGET_URL=http://localhost:8000',
      'K6_BINARY=k6',
      'K6_MAX_VUS=50',
    ]);

    const packageJson = await readPackageJson(projectDir);
    expect(packageJson.scripts?.['loadtest:api']).toBe('node customer-api/server.js');
    expect(packageJson.scripts?.demo).toBe('node scripts/demo.mjs');
    expect(packageJson.scripts?.['fdekit:loadtest:run']).toContain('fdekit run loadTestAgent');
    expect(packageJson.scripts?.['fdekit:loadtest:approvals']).toBe('fdekit approvals list');
    expect(packageJson.scripts?.['fdekit:loadtest:audit']).toBe('fdekit audit');
    expect(packageJson.scripts?.['fdekit:loadtest:feedback']).toBe('fdekit feedback export');
    expect(packageJson.dependencies?.['@fdekit/connector-k6']).toBe(fdekitDependencyVersion);
    expect(packageJson.dependencies?.['@fdekit/core']).toBe(fdekitDependencyVersion);
    expect(packageJson.devDependencies?.['@fdekit/cli']).toBe(fdekitDependencyVersion);

    const validateOutput = await captureCommand(() => cmdValidate({
      cwd: projectDir,
      args: ['--strict'],
    }));

    expect(validateOutput.exitCode).toBeUndefined();
    expect(validateOutput.stdout).toContain('No validation issues found');
    expect(validateOutput.stdout).not.toContain('Harness references unknown policy "restrict-environments"');

    const runOutput = await captureCommand(() => cmdRun({
      cwd: projectDir,
      args: ['loadTestAgent', '--input', '{"scenario":"smoke","targetUrl":"http://localhost:8000","vus":5,"duration":"10s"}'],
    }));

    expect(runOutput.exitCode).toBeUndefined();
    expect(runOutput.stdout).toContain('Agent: loadTestAgent');
    expect(runOutput.stdout).toContain('Tool calls: loadtest.run');
    expect(runOutput.stdout).toContain('Final answer: Load test passed');

    const evalOutput = await captureCommand(() => cmdEval({ cwd: projectDir, args: ['run'] }));
    expect(evalOutput.exitCode).toBeUndefined();
    expect(evalOutput.stdout).toContain('Eval status: passed');
  });


  it('captures the current deployment as a reusable local recipe', async () => {
    const cwd = await mkProjectRoot('fdekit-cli-recipe-capture-');
    await captureCommand(() => cmdInit({ cwd, args: ['source-app'] }));
    const projectDir = path.join(cwd, 'source-app');

    const output = await captureCommand(() => cmdRecipe({
      cwd: projectDir,
      args: ['capture', 'renewal-risk'],
    }));

    expect(output.exitCode).toBeUndefined();
    expect(output.stdout).toContain('Captured recipe renewal-risk');
    expect(output.stdout).toContain('fdekit recipe install recipes/renewal-risk');

    const recipeDir = path.join(projectDir, 'recipes', 'renewal-risk');
    await expectFiles(recipeDir, [
      'recipe.json',
      'README.md',
      'fde.config.ts',
      '.env.example',
      'workflow.md',
      'agents/support-triage.md',
      'evals/support-triage.json',
      'artifacts/deployment-snapshot.json',
    ]);

    const manifest = JSON.parse(await readFile(path.join(recipeDir, 'recipe.json'), 'utf8')) as {
      name?: string;
      sourceDeployment?: string;
      install?: { files?: string[] };
      workflow?: { name?: string };
      harness?: { name?: string };
      package?: { dependencies?: Record<string, string> };
      evidence?: { deploymentSnapshot?: string };
    };

    expect(manifest.name).toBe('renewal-risk');
    expect(manifest.sourceDeployment).toBe('source-app');
    expect(manifest.workflow?.name).toBe('Starter support triage');
    expect(manifest.harness?.name).toBe('starter-governed-loop');
    expect(manifest.install?.files).toEqual(expect.arrayContaining([
      'fde.config.ts',
      '.env.example',
      'workflow.md',
      'agents',
      'evals',
    ]));
    expect(manifest.package?.dependencies?.['@fdekit/core']).toBe(fdekitCaretDependencyVersion);
    expect(manifest.evidence?.deploymentSnapshot).toBe('artifacts/deployment-snapshot.json');
  });


  it('installs a captured recipe by path into another project', async () => {
    const sourceCwd = await mkProjectRoot('fdekit-cli-recipe-source-');
    await captureCommand(() => cmdInit({ cwd: sourceCwd, args: ['source-app'] }));
    const sourceProjectDir = path.join(sourceCwd, 'source-app');
    await captureCommand(() => cmdRecipe({
      cwd: sourceProjectDir,
      args: ['capture', 'renewal-risk'],
    }));

    const targetCwd = await mkProjectRoot('fdekit-cli-recipe-target-');
    await captureCommand(() => cmdInit({ cwd: targetCwd, args: ['target-app'] }));
    const targetProjectDir = path.join(targetCwd, 'target-app');
    const recipePath = path.join(sourceProjectDir, 'recipes', 'renewal-risk');

    const output = await captureCommand(() => cmdRecipe({
      cwd: targetProjectDir,
      args: ['install', recipePath],
    }));

    expect(output.exitCode).toBeUndefined();
    expect(output.stdout).toContain('Installed recipe renewal-risk');
    expect(output.stdout).toContain('Config updated:');
    await expectFiles(targetProjectDir, [
      'recipes/renewal-risk/recipe.json',
      'agents/support-triage.md',
      'evals/support-triage.json',
    ]);

    expectTextIncludes(await readConfig(targetProjectDir), [
      "name: 'source-app'",
      'workflow: defineWorkflow({',
      'harness: defineHarness({',
    ]);

    const packageJson = await readPackageJson(targetProjectDir);
    expect(packageJson.dependencies?.['@fdekit/core']).toBe(fdekitCaretDependencyVersion);
    expect(packageJson.scripts?.dev).toBe('fdekit dev');
  });


  it('preserves custom configs when installing the support-triage recipe', async () => {
    const projectDir = await mkProjectRoot('fdekit-cli-recipe-custom-');
    await writeFile(path.join(projectDir, 'fde.config.ts'), `export default {
  name: 'custom',
  providers: {},
  agents: {},
};
`, 'utf8');

    const output = await captureCommand(() => cmdRecipe({
      cwd: projectDir,
      args: ['install', 'support-triage'],
    }));

    expect(output.stdout).toContain('Existing fde.config.ts was preserved');
    expect(await readConfig(projectDir)).toContain("name: 'custom'");
    await expectFiles(projectDir, ['recipes/support-triage/fde.config.ts']);
  });


  it('preserves custom configs when installing the codebase-agent recipe', async () => {
    const projectDir = await mkProjectRoot('fdekit-cli-codebase-recipe-custom-');
    await writeFile(path.join(projectDir, 'fde.config.ts'), `export default {
  name: 'custom',
  providers: {},
  agents: {},
};
`, 'utf8');

    const output = await captureCommand(() => cmdRecipe({
      cwd: projectDir,
      args: ['install', 'codebase-agent'],
    }));

    expect(output.stdout).toContain('Existing fde.config.ts was preserved');
    expect(output.stdout).toContain('recipes/codebase-agent/fde.config.ts');
    expect(await readConfig(projectDir)).toContain("name: 'custom'");
    await expectFiles(projectDir, [
      'recipes/codebase-agent/fde.config.ts',
      'sample-repo/src/billing.ts',
    ]);
  });


  it('preserves custom configs when installing the sales-research-agent recipe', async () => {
    const projectDir = await mkProjectRoot('fdekit-cli-sales-recipe-custom-');
    await writeFile(path.join(projectDir, 'fde.config.ts'), `export default {
  name: 'custom',
  providers: {},
  agents: {},
};
`, 'utf8');

    const output = await captureCommand(() => cmdRecipe({
      cwd: projectDir,
      args: ['install', 'sales-research-agent'],
    }));

    expect(output.stdout).toContain('Existing fde.config.ts was preserved');
    expect(output.stdout).toContain('recipes/sales-research-agent/fde.config.ts');
    expect(await readConfig(projectDir)).toContain("name: 'custom'");
    await expectFiles(projectDir, [
      'recipes/sales-research-agent/fde.config.ts',
      'sales-data/prospects.json',
    ]);
  });
});
