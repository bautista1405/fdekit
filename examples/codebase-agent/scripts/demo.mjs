#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const runInput = {
  task: 'Find TODO(fdekit) markers and create an engineering issue',
  query: 'TODO(fdekit)',
};

printHeader('FDEKit Codebase Agent Demo');
console.log('Story: local repository review, governed issue creation, evals, dashboard, and recipe capture');

await run('fdekit', ['doctor']);
await run('fdekit', ['validate']);
await run('fdekit', ['run', 'codebaseAgent', '--input', JSON.stringify(runInput)]);
await run('fdekit', ['feedback', 'export']);
await run('fdekit', ['eval', 'run', 'codebaseAgent']);
await run('fdekit', ['eval', 'macro']);
await run('fdekit', ['report']);
await run('fdekit', ['console']);
await run('fdekit', ['recipe', 'capture', 'codebase-agent-repository-review', '--force']);

printHeader('Demo Ready');
console.log(`Open dashboard: ${join(process.cwd(), 'artifacts', 'console.html')}`);
console.log(`Captured recipe: ${join(process.cwd(), 'recipes', 'codebase-agent-repository-review')}`);

async function run(command, commandArgs) {
  printHeader([command, ...commandArgs].join(' '));

  await new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        FDEKIT_PROVIDER: process.env.FDEKIT_PROVIDER ?? 'mock',
        FDEKIT_CONNECTOR_MODE: process.env.FDEKIT_CONNECTOR_MODE ?? 'local',
        FDEKIT_ISSUE_TRACKER: process.env.FDEKIT_ISSUE_TRACKER ?? 'github',
        CODEBASE_ROOT: process.env.CODEBASE_ROOT ?? './sample-repo',
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
