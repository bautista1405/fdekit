#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const WAITING_APPROVAL_EXIT_CODE = 2;
const AGENT_NAME = 'salesResearchAgent';
const runInput = {
  accountId: 'acct_company',
  persona: 'CRO',
};

printHeader('FDEKit Sales Research Agent Demo');
console.log('Story: local CRM research, governed CRM note, evals, dashboard, and recipe capture');

await run('fdekit', ['doctor']);
await run('fdekit', ['validate']);
await runGovernedAgent();
await run('fdekit', ['feedback', 'export']);
await run('fdekit', ['eval', 'run', 'salesResearchAgent']);
await run('fdekit', ['eval', 'macro']);
await run('fdekit', ['report']);
await run('fdekit', ['console']);
await run('fdekit', ['recipe', 'capture', 'sales-research-account-brief', '--force']);

printHeader('Demo Ready');
console.log(`Open dashboard: ${join(process.cwd(), 'artifacts', 'console.html')}`);
console.log(`Captured recipe: ${join(process.cwd(), 'recipes', 'sales-research-account-brief')}`);

async function runGovernedAgent() {
  let code = await run('fdekit', ['run', AGENT_NAME, '--input', JSON.stringify(runInput)], {
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
    FDEKIT_PROVIDER: process.env.FDEKIT_PROVIDER ?? 'mock',
    FDEKIT_CRM: process.env.FDEKIT_CRM ?? 'local',
    FDEKIT_CONNECTOR_MODE: process.env.FDEKIT_CONNECTOR_MODE ?? 'local',
    SALES_RESEARCH_DATASET: process.env.SALES_RESEARCH_DATASET ?? './sales-data/prospects.json',
  };
}

function printHeader(title) {
  console.log('');
  console.log(`== ${title}`);
}
