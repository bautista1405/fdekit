#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const supportDir = join(rootDir, 'examples', 'support-triage');
const cliPath = join(rootDir, 'packages', 'cli', 'dist', 'index.js');
const args = new Set(process.argv.slice(2));
const skipBuild = args.has('--skip-build');
const useLoadTestingAgent = args.has('--load-testing-agent');
const useCodebaseAgent = args.has('--codebase-agent');
const supportHealthUrl = process.env.CUSTOMER_API_URL
  ? new URL('/health', process.env.CUSTOMER_API_URL).href
  : 'http://127.0.0.1:8787/health';
const realCustomerApiUrl = process.env.REAL_CUSTOMER_API_URL ?? 'http://localhost:8000';
const realCustomerHealthUrl = process.env.REAL_CUSTOMER_HEALTH_URL
  ?? (realCustomerApiUrl ? new URL('/healthz', realCustomerApiUrl).href : null);

let supportApiProcess = null;

try {
  if (!skipBuild) {
    await run('npm', ['run', 'build'], { cwd: rootDir });
  } else if (!existsSync(cliPath)) {
    throw new Error('CLI build output is missing. Run without --skip-build or run npm run build first.');
  }

  await ensureRecipeExamplesInSync();

  if (useCodebaseAgent) {
    await runCodebaseAgentDemo();
  } else if (useLoadTestingAgent) {
    await runLoadTestingAgentDemo();
  } else {
    await runSupportTriageDemo();
  }
} finally {
  if (supportApiProcess) {
    supportApiProcess.kill('SIGTERM');
  }
}

async function runSupportTriageDemo() {
  printHeader('FDEKit Demo');
  console.log('Story: support triage agent connected to a customer API, issue tracker, Slack-style handoff, governance, evals, dashboard, and recipe capture.');
  console.log('');

  supportApiProcess = await ensureSupportApi();

  await run('npm', ['run', 'fdekit:doctor'], { cwd: supportDir });
  await run('npm', ['run', 'fdekit:validate'], { cwd: supportDir });
  await run('npm', ['run', 'fdekit:run'], { cwd: supportDir });
  await run('npm', ['run', 'fdekit:feedback'], { cwd: supportDir });
  await run('npm', ['run', 'fdekit:eval'], { cwd: supportDir });
  await run('npm', ['run', 'fdekit:macro'], { cwd: supportDir });
  await run('npm', ['run', 'fdekit:report'], { cwd: supportDir });
  await run('npm', ['run', 'fdekit:console'], { cwd: supportDir });
  const capturedRecipe = await captureDemoRecipe(supportDir, 'support-renewal-risk');

  printHeader('Demo Ready');
  console.log(`Open dashboard: ${join(supportDir, '.fdekit', 'console.html')}`);
  console.log(`Captured recipe: ${capturedRecipe}`);
  console.log('');
  console.log('Talk track: "We ran a customer-shaped agent loop, proved external actions, checked governance/evals, created a stakeholder dashboard, then captured the workflow as a reusable recipe."');
}

async function runLoadTestingAgentDemo() {
  const loadTestingDir = join(rootDir, 'examples', 'load-test-agent');

  printHeader('FDEKit Load Test Agent Demo');
  console.log('Story: load-test agent connected to a real customer API, producing run artifacts, evals, dashboard output, and a reusable recipe.');
  console.log('');

  if (!realCustomerApiUrl) {
    throw new Error('Set REAL_CUSTOMER_API_URL to the real customer API base URL before running the load-test-agent demo.');
  }

  if (!existsSync(loadTestingDir)) {
    throw new Error(`Load test agent example is missing at ${loadTestingDir}`);
  }

  if (realCustomerHealthUrl && !(await isHealthy(realCustomerHealthUrl))) {
    throw new Error(`Real customer API did not pass health check at ${realCustomerHealthUrl}`);
  }

  await run('npm', ['run', 'fdekit:validate'], {
    cwd: loadTestingDir,
    env: {
      CUSTOMER_API_URL: realCustomerApiUrl,
      REAL_CUSTOMER_API_URL: realCustomerApiUrl,
    },
  });
  await run('npm', ['run', 'fdekit:run'], {
    cwd: loadTestingDir,
    env: {
      CUSTOMER_API_URL: realCustomerApiUrl,
      REAL_CUSTOMER_API_URL: realCustomerApiUrl,
    },
  });
  await run('npm', ['run', 'fdekit:eval'], {
    cwd: loadTestingDir,
    env: {
      CUSTOMER_API_URL: realCustomerApiUrl,
      REAL_CUSTOMER_API_URL: realCustomerApiUrl,
    },
  });
  await run('npm', ['run', 'fdekit:report'], {
    cwd: loadTestingDir,
    env: {
      CUSTOMER_API_URL: realCustomerApiUrl,
      REAL_CUSTOMER_API_URL: realCustomerApiUrl,
    },
  });
  await run('npm', ['run', 'fdekit:console'], {
    cwd: loadTestingDir,
    env: {
      CUSTOMER_API_URL: realCustomerApiUrl,
      REAL_CUSTOMER_API_URL: realCustomerApiUrl,
    },
  });
  const capturedRecipe = await captureDemoRecipe(loadTestingDir, 'load-testing-real-customer-api', {
    env: {
      CUSTOMER_API_URL: realCustomerApiUrl,
      REAL_CUSTOMER_API_URL: realCustomerApiUrl,
    },
  });

  printHeader('Load Testing Demo Ready');
  console.log(`Real customer API: ${realCustomerApiUrl}`);
  console.log(`Open dashboard: ${join(loadTestingDir, '.fdekit', 'console.html')}`);
  console.log(`Captured recipe: ${capturedRecipe}`);
  console.log('');
  console.log('Talk track: "We pointed the load-testing agent at a real customer API, generated evidence from an actual run, evaluated the outcome, published the dashboard, and captured the workflow as a reusable recipe."');
}

async function runCodebaseAgentDemo() {
  const codebaseDir = join(rootDir, 'examples', 'codebase-agent');

  printHeader('FDEKit Codebase Agent Demo');
  console.log('Story: codebase agent analyzes a real repository, produces grounded implementation guidance, runs checks and evals, publishes dashboard output, and captures a reusable recipe.');
  console.log('');

  if (!existsSync(codebaseDir)) {
    throw new Error(`Codebase agent example is missing at ${codebaseDir}`);
  }

  await run('npm', ['run', 'fdekit:validate'], { cwd: codebaseDir });
  await run('npm', ['run', 'fdekit:run'], { cwd: codebaseDir });
  await run('npm', ['run', 'fdekit:eval'], { cwd: codebaseDir });
  await run('npm', ['run', 'fdekit:report'], { cwd: codebaseDir });
  await run('npm', ['run', 'fdekit:console'], { cwd: codebaseDir });
  const capturedRecipe = await captureDemoRecipe(codebaseDir, 'codebase-agent-repository-review');

  printHeader('Codebase Agent Demo Ready');
  console.log(`Open dashboard: ${join(codebaseDir, '.fdekit', 'console.html')}`);
  console.log(`Captured recipe: ${capturedRecipe}`);
  console.log('');
  console.log('Talk track: "We pointed the codebase agent at a repository, generated grounded engineering guidance, ran checks and evals, published the dashboard, and captured the workflow as a reusable recipe."');
}

async function ensureSupportApi() {
  if (await isHealthy(supportHealthUrl)) {
    console.log(`Customer API already running: ${supportHealthUrl}`);
    return null;
  }

  printHeader('Starting Customer API');
  const child = spawn('npm', ['run', 'api'], {
    cwd: supportDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[customer-api] ${chunk}`);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[customer-api] ${chunk}`);
  });

  await waitForHealth(supportHealthUrl, 10000);
  console.log(`Customer API ready: ${supportHealthUrl}`);
  return child;
}

async function captureDemoRecipe(cwd, recipeName, options = {}) {
  await run('node', [cliPath, 'recipe', 'capture', recipeName, '--force'], {
    cwd,
    env: options.env,
  });

  return join(cwd, 'recipes', recipeName);
}

async function ensureRecipeExamplesInSync() {
  await run('npm', ['run', 'examples:check'], { cwd: rootDir });
}

async function waitForHealth(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isHealthy(url)) {
      return;
    }

    await sleep(250);
  }

  throw new Error(`Customer API did not become healthy at ${url}`);
}

async function isHealthy(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function run(command, commandArgs, options) {
  printHeader([command, ...commandArgs].join(' '));

  await new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...options.env,
        FDEKIT_CONNECTOR_MODE: process.env.FDEKIT_CONNECTOR_MODE ?? 'local',
      },
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${commandArgs.join(' ')} exited with ${code}`));
      }
    });
  });
}

function printHeader(title) {
  console.log('');
  console.log(`== ${title}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
