#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const runInput = {
  accountId: 'acct_company',
  persona: 'CRO',
};

printHeader('FDEKit Sales Research Agent Demo');
console.log('Story: local CRM research, governed CRM note, evals, dashboard, and recipe capture');

await run('fdekit', ['doctor']);
await run('fdekit', ['validate']);
await run('fdekit', ['run', 'salesResearchAgent', '--input', JSON.stringify(runInput)]);
await run('fdekit', ['feedback', 'export']);
await run('fdekit', ['eval', 'run']);
await run('fdekit', ['eval', 'macro']);
await run('fdekit', ['report']);
await run('fdekit', ['console']);
await run('fdekit', ['recipe', 'capture', 'sales-research-account-brief', '--force']);

printHeader('Demo Ready');
console.log(`Open dashboard: ${join(process.cwd(), '.fdekit', 'console.html')}`);
console.log(`Captured recipe: ${join(process.cwd(), 'recipes', 'sales-research-account-brief')}`);

async function run(command, commandArgs) {
  printHeader([command, ...commandArgs].join(' '));

  await new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        FDEKIT_PROVIDER: process.env.FDEKIT_PROVIDER ?? 'mock',
        FDEKIT_CRM: process.env.FDEKIT_CRM ?? 'local',
        FDEKIT_CONNECTOR_MODE: process.env.FDEKIT_CONNECTOR_MODE ?? 'local',
        SALES_RESEARCH_DATASET: process.env.SALES_RESEARCH_DATASET ?? './sales-data/prospects.json',
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
