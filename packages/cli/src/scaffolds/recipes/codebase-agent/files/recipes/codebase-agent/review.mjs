#!/usr/bin/env node
// Graded review orchestrator: runs the assess flow read-only, verifies and
// grades every finding, persists the review artifact, and only then posts -
// gated by --mode. The judge is a second agent run (reviewJudge), so grading
// works with any configured provider, including mock.
//
// Usage: node recipes/codebase-agent/review.mjs --pr 1 --mode shadow|advisory|request-changes
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { asRecord, formatDroppedFindings, getString, parseFindings } from '@fdekit/core';
import {
  createArtifactStore,
  createFsSourceReader,
  executeGovernedToolSequence,
  loadDeployment,
  requireConfigFile,
  runGrader,
  writeJsonArtifact,
  writeReviewArtifact,
} from '@fdekit/runtime';

const args = parseArgs(process.argv.slice(2));
const prNumber = Number(args.pr ?? 1);
const mode = args.mode ?? 'shadow';

if (!['shadow', 'advisory', 'request-changes'].includes(mode)) {
  console.error(`Unknown --mode "${mode}"; use shadow, advisory, or request-changes.`);
  process.exit(1);
}

const configPath = await requireConfigFile(process.cwd());
const projectDir = path.dirname(configPath);
const deployment = await loadDeployment(configPath);
const artifactStore = createArtifactStore({ deployment, projectDir });

const grader = {
  name: 'review-grader',
  rubric: [
    'Keep findings that a senior engineer would act on: correctness, security,',
    'architecture, performance, tests, or intent gaps - each grounded in the',
    'cited code. Suppress speculation, style nits, and claims the cited lines',
    'do not support.',
  ].join('\n'),
  threshold: 0.6,
  maxFindings: 10,
};

printHeader(`Assess pull request #${prNumber} (read-only)`);
const assess = await runFdekit(['run', 'codebaseAgent', '--input', JSON.stringify({
  task: `Review pull request #${prNumber}`,
  pr: prNumber,
  reviewMode: 'shadow',
})]);
const tracePath = /Trace written: (.+)/.exec(assess.stdout)?.[1]?.trim();
const finalAnswer = /Final answer: ([\s\S]*)$/.exec(assess.stdout)?.[1] ?? '';

printHeader('Parse findings against the review contract');
const parsed = parseFindings(extractFindingsValue(finalAnswer));
console.log(`valid: ${parsed.valid.length}, dropped: ${parsed.invalid}`);

if (parsed.dropped.length > 0) {
  console.log(formatDroppedFindings(parsed.dropped));
}

printHeader('Verify locations and grade each finding');
const readSource = createFsSourceReader(path.resolve(projectDir, process.env.CODEBASE_ROOT ?? './sample-repo'));
const graded = await runGrader(grader, parsed.valid, {
  readSource,
  judge: judgeViaAgent,
  trace: (event) => {
    if (event.type === 'grader.finding.scored') {
      console.log(`  ${event.finding} (${event.category}) -> score ${event.score}${event.reason ? ` - ${event.reason}` : ''}`);
    } else if (event.type === 'grader.findings.rejected') {
      console.log(`  ${event.detail}`);
    }
  },
});
console.log(`kept: ${graded.kept.length}, suppressed: ${graded.suppressed.length}, rejected: ${graded.rejected.length}`);

const recommendation = mode === 'request-changes' && graded.kept.some((finding) => finding.severity === 'high')
  ? 'request-changes'
  : 'comment';
const runId = tracePath ? path.basename(tracePath, '.json') : `review_${Date.now()}`;
const artifactPath = await writeReviewArtifact(projectDir, {
  runId,
  source: { kind: 'github-pr', number: prNumber },
  findings: graded.kept,
  suppressed: graded.suppressed,
  recommendation,
  createdAt: new Date().toISOString(),
});
console.log(`Review artifact: ${artifactPath}`);

if (mode === 'shadow' || graded.kept.length === 0) {
  printHeader('Shadow mode: nothing posted');
  console.log(`Recommendation would be: ${recommendation}. Re-run with --mode advisory or --mode request-changes to post.`);
  process.exit(0);
}

printHeader(`Post graded review (${mode})`);
const delivery = await executeGovernedToolSequence({
  deployment,
  projectDir,
  artifactStore,
  agentName: 'codebaseAgent',
  input: {
    task: 'Deliver a graded pull-request review',
    reviewRunId: runId,
    reviewArtifact: artifactPath,
    reviewMode: mode,
  },
  calls: [
    {
      toolName: 'github.review.post',
      args: {
        number: prNumber,
        summary: `Graded review: ${graded.kept.length} finding(s) kept, ${graded.suppressed.length} suppressed. Recommendation: ${recommendation}.`,
        recommendation,
        comments: graded.kept.map((finding) => ({
          path: finding.file,
          line: finding.line,
          body: `[${finding.severity}/${finding.category}] ${finding.rationale}${finding.suggestion ? ` Suggestion: ${finding.suggestion}` : ''}`,
        })),
      },
    },
    {
      toolName: 'slack.notify',
      args: {
        title: `Pull request #${prNumber}`,
        recommendation,
        // The Slack connector requires a stable URL before the GitHub call
        // executes. GitHub uses the same configured repository URL shape.
        prUrl: githubPullRequestUrl(deployment, prNumber),
        findingsSummary: graded.kept.map((finding) => `${finding.file}:${finding.line} ${finding.rationale}`),
      },
    },
  ],
});
const deliveryTracePath = await writeJsonArtifact(
  projectDir,
  'traces',
  `${delivery.trace.id}.json`,
  delivery.trace,
  artifactStore,
);
console.log(`Delivery trace: ${deliveryTracePath}`);

if (delivery.status === 'waiting_approval') {
  const pending = delivery.approvals.find((approval) => approval.status === 'pending');

  if (pending) {
    console.log(`Approval required: ${pending.id} for ${pending.toolName}`);
    console.log(`Next: fdekit approvals approve ${pending.id} --by <name> --reason "<reason>", then continue with: fdekit run ${delivery.agent} --resume ${delivery.id}`);
  }

  process.exit(2);
}

const posted = asRecord(delivery.toolCalls.find((call) => call.name === 'github.review.post')?.result);
const notified = asRecord(delivery.toolCalls.find((call) => call.name === 'slack.notify')?.result);
console.log(`Review posted: ${getString(posted.url) ?? 'completed (see delivery trace)'}`);
console.log(`Reviewers notified in ${getString(notified.channel) ?? 'configured Slack channel'}`);

function githubPullRequestUrl(deployment, number) {
  const github = Object.values(deployment.connectors ?? {}).find((connector) => (
    connector.name === 'github'
  ));
  const repository = getString(asRecord(github?.config).repository) ?? process.env.GITHUB_REPOSITORY ?? 'owner/repo';

  return `https://github.com/${repository}/pull/${number}`;
}

async function judgeViaAgent(prompt) {
  const result = await runFdekit(['run', 'reviewJudge', '--input', JSON.stringify({
    task: 'Score one review finding',
    judgePrompt: prompt,
  })], { quiet: true });

  return /Final answer: ([\s\S]*)$/.exec(result.stdout)?.[1] ?? '';
}

function extractFindingsValue(text) {
  const match = /\[[\s\S]*\]/.exec(text);

  if (!match) {
    return [];
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
}

async function runFdekit(commandArgs, options = {}) {
  if (!options.quiet) {
    printHeader(['fdekit', ...commandArgs].join(' '));
  }

  return new Promise((resolve, reject) => {
    const child = spawn('fdekit', commandArgs, {
      shell: process.platform === 'win32',
      cwd: projectDir,
      env: {
        ...process.env,
        PATH: `${path.join(process.cwd(), 'node_modules', '.bin')}${path.delimiter}${process.env.PATH ?? ''}`,
        FDEKIT_PROVIDER: process.env.FDEKIT_PROVIDER ?? 'mock',
        FDEKIT_CONNECTOR_MODE: process.env.FDEKIT_CONNECTOR_MODE ?? 'local',
        FDEKIT_ISSUE_TRACKER: process.env.FDEKIT_ISSUE_TRACKER ?? 'github',
        CODEBASE_ROOT: process.env.CODEBASE_ROOT ?? './sample-repo',
      },
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);

      if (!options.quiet) {
        process.stdout.write(chunk);
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);

      if (!options.quiet) {
        process.stderr.write(chunk);
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`fdekit ${commandArgs.join(' ')} exited with ${code}\n${stderr}`));
      }
    });
  });
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith('--')) {
      parsed[argv[index].slice(2)] = argv[index + 1];
      index += 1;
    }
  }

  return parsed;
}

function printHeader(title) {
  console.log('');
  console.log(`== ${title}`);
}
