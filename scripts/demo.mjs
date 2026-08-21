#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = join(rootDir, 'packages', 'cli', 'dist', 'index.js');
const args = new Set(process.argv.slice(2));
const skipBuild = args.has('--skip-build');

const demos = [
  {
    flag: '--support-triage',
    label: 'support triage',
    workspace: '@fdekit/example-support-triage',
  },
  {
    flag: '--codebase-agent',
    label: 'codebase review',
    workspace: '@fdekit/example-codebase-agent',
  },
  {
    flag: '--sales-research-agent',
    label: 'sales research',
    workspace: '@fdekit/example-sales-research-agent',
  },
  {
    flag: '--load-testing-agent',
    label: 'load testing',
    workspace: '@fdekit/example-load-test-agent',
  },
];

const selected = demos.filter((demo) => args.has(demo.flag));
if (selected.length > 1) {
  throw new Error(`Choose one demo: ${demos.map((demo) => demo.flag).join(', ')}`);
}

const demo = selected[0] ?? demos[0];

if (!skipBuild) {
  await run('npm', ['run', 'build']);
} else if (!existsSync(cliPath)) {
  throw new Error('CLI build output is missing. Run without --skip-build or run npm run build first.');
}

await run('npm', ['run', 'examples:check']);

printHeader(`Running the ${demo.label} demo`);
await run('npm', ['run', 'demo', '--workspace', demo.workspace]);

async function run(command, commandArgs) {
  printHeader([command, ...commandArgs].join(' '));

  await new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
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
