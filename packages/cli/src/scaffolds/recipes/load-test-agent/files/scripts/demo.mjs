#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const targetUrl = process.env.LOAD_TEST_TARGET_URL ?? 'http://127.0.0.1:8788';
const healthUrl = new URL('/health', targetUrl).href;
const servicePort = new URL(targetUrl).port || '8788';
const runInput = {
  scenario: 'smoke',
  targetUrl,
  vus: 5,
  duration: '10s',
};

let apiProcess = null;

try {
  printHeader('FDEKit Load Test Agent Demo');
  console.log('Story: bounded local load-test run, threshold evals, dashboard, and recipe capture');

  apiProcess = await ensureCustomerApi();

  await run('fdekit', ['validate']);
  await run('fdekit', ['run', 'loadTestAgent', '--input', JSON.stringify(runInput)]);
  await run('fdekit', ['feedback', 'export']);
  await run('fdekit', ['eval', 'run']);
  await run('fdekit', ['eval', 'macro']);
  await run('fdekit', ['report']);
  await run('fdekit', ['console']);
  await run('fdekit', ['recipe', 'capture', 'load-test-local-readiness', '--force']);

  printHeader('Demo Ready');
  console.log(`Target API: ${targetUrl}`);
  console.log(`Open dashboard: ${join(process.cwd(), 'artifacts', 'console.html')}`);
  console.log(`Captured recipe: ${join(process.cwd(), 'recipes', 'load-test-local-readiness')}`);
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
  const child = spawn('node', ['customer-api/server.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      PORT: servicePort,
    },
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
        FDEKIT_PROVIDER: process.env.FDEKIT_PROVIDER ?? 'mock',
        FDEKIT_LOAD_TEST_MODE: process.env.FDEKIT_LOAD_TEST_MODE ?? 'local',
        LOAD_TEST_TARGET_URL: targetUrl,
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
