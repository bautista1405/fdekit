#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const healthUrl = process.env.CUSTOMER_API_URL
  ? new URL('/health', process.env.CUSTOMER_API_URL).href
  : 'http://127.0.0.1:8787/health';

let apiProcess = null;

try {
  printHeader('FDEKit Support Triage Demo');
  console.log('Story: local customer API, governed support triage run, evals, dashboard, and recipe capture');

  apiProcess = await ensureCustomerApi();

  await run('npm', ['run', 'fdekit:doctor']);
  await run('npm', ['run', 'fdekit:validate']);
  await run('npm', ['run', 'fdekit:run']);
  await run('npm', ['run', 'fdekit:feedback']);
  await run('npm', ['run', 'fdekit:eval']);
  await run('npm', ['run', 'fdekit:macro']);
  await run('npm', ['run', 'fdekit:report']);
  await run('npm', ['run', 'fdekit:console']);
  await run('fdekit', ['recipe', 'capture', 'support-renewal-risk', '--force']);

  printHeader('Demo Ready');
  console.log(`Open dashboard: ${join(process.cwd(), '.fdekit', 'console.html')}`);
  console.log(`Captured recipe: ${join(process.cwd(), 'recipes', 'support-renewal-risk')}`);
} finally {
  if (apiProcess) {
    apiProcess.kill('SIGTERM');
  }
}

async function ensureCustomerApi() {
  if (await isHealthy(healthUrl)) {
    console.log(`Customer API already running: ${healthUrl}`);
    return null;
  }

  printHeader('Starting Customer API');
  const child = spawn('npm', ['run', 'api'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[customer-api] ${chunk}`);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[customer-api] ${chunk}`);
  });

  await waitForHealth(healthUrl, 10000);
  console.log(`Customer API ready: ${healthUrl}`);
  return child;
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

async function run(command, commandArgs) {
  printHeader([command, ...commandArgs].join(' '));

  await new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
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
