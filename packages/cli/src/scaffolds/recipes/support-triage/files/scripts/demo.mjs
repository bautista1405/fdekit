#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const WAITING_APPROVAL_EXIT_CODE = 2;
const AGENT_NAME = 'supportTriage';

const healthUrl = process.env.CUSTOMER_API_URL
  ? new URL('/health', process.env.CUSTOMER_API_URL).href
  : 'http://127.0.0.1:8787/health';

let apiProcess = null;
const warnings = [];

try {
  printHeader('FDEKit Support Triage Demo');
  console.log('Story: local customer API, governed support triage run with a human approval loop, evals, dashboard, and recipe capture');

  apiProcess = await ensureCustomerApi();

  await run('fdekit', ['doctor']);
  await run('fdekit', ['validate']);
  await runGovernedAgent();
  await run('fdekit', ['feedback', 'export']);
  await runEvalsTolerantly();
  await run('fdekit', ['eval', 'macro']);
  await run('fdekit', ['report']);
  await run('fdekit', ['console']);
  await run('fdekit', ['recipe', 'capture', 'support-renewal-risk', '--force']);

  printHeader('Demo Ready');
  console.log(`Open dashboard: ${join(process.cwd(), 'artifacts', 'console.html')}`);
  console.log(`Captured recipe: ${join(process.cwd(), 'recipes', 'support-renewal-risk')}`);

  for (const warning of warnings) {
    console.log(`Note: ${warning}`);
  }
} finally {
  if (apiProcess) {
    apiProcess.kill('SIGTERM');
  }
}

/**
 * Runs the governed agent and walks the human review loop: external writes are
 * approval-gated, so the run pauses (exit code 2), a reviewer approves the
 * request, and `--resume` executes the approved call and continues the run.
 */
async function runGovernedAgent() {
  let code = await run('fdekit', ['run', AGENT_NAME, '--ticket', 'tick_1001'], {
    allowedCodes: [0, WAITING_APPROVAL_EXIT_CODE],
  });

  for (let round = 1; code === WAITING_APPROVAL_EXIT_CODE; round += 1) {
    if (round > 6) {
      throw new Error('Approval loop did not converge after 6 rounds');
    }

    const pending = JSON.parse(await runCapture('fdekit', ['approvals', 'list', '--status', 'pending', '--json']));

    if (pending.length === 0) {
      throw new Error('Run is waiting for approval but no pending approval requests were found');
    }

    for (const approval of pending) {
      printHeader(`Human review round ${round}: approving ${approval.toolName}`);
      await run('fdekit', ['approvals', 'show', approval.id]);
      await run('fdekit', [
        'approvals', 'approve', approval.id,
        '--by', 'fdekit-demo',
        '--reason', 'Approved in the demo walkthrough',
      ]);
    }

    printHeader(`Resuming the paused run (round ${round})`);
    code = await run('fdekit', ['run', AGENT_NAME, '--resume'], {
      allowedCodes: [0, WAITING_APPROVAL_EXIT_CODE],
    });
  }
}

/**
 * Evals are expected to pass with the deterministic mock planner, but live
 * providers plan nondeterministically and can fail dataset assertions. The
 * demo reports the failure and keeps going instead of crashing.
 */
async function runEvalsTolerantly() {
  const code = await run('fdekit', ['eval', 'run', AGENT_NAME], { allowedCodes: [0, 1] });

  if (code !== 0) {
    warnings.push('Evals failed for this provider. See artifacts/evals/latest.json; live providers may need looser assertions than the mock-calibrated dataset.');
    console.log('\nEvals failed; continuing the demo. Failing assertions are listed above.');
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

async function run(command, commandArgs, options = {}) {
  const allowedCodes = options.allowedCodes ?? [0];
  printHeader([command, ...commandArgs].join(' '));

  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: demoEnv(),
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (allowedCodes.includes(code)) {
        resolve(code);
      } else {
        reject(new Error(`${command} ${commandArgs.join(' ')} exited with ${code}`));
      }
    });
  });
}

async function runCapture(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: ['ignore', 'pipe', 'inherit'],
      shell: process.platform === 'win32',
      env: demoEnv(),
    });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`${command} ${commandArgs.join(' ')} exited with ${code}`));
      }
    });
  });
}

function demoEnv() {
  return {
    ...process.env,
    FDEKIT_CONNECTOR_MODE: process.env.FDEKIT_CONNECTOR_MODE ?? 'local',
  };
}

function printHeader(title) {
  console.log('');
  console.log(`== ${title}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
