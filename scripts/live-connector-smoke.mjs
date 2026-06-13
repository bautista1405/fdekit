#!/usr/bin/env node

const args = new Set(process.argv.slice(2));
const requireAtLeastOne = args.has('--require-at-least-one')
  || process.env.FDEKIT_LIVE_SMOKE_REQUIRE === 'true';
const selectedConnectors = parseConnectorFilter(process.env.FDEKIT_LIVE_SMOKE_CONNECTORS);
const sandboxAcknowledged = process.env.FDEKIT_LIVE_SMOKE_SANDBOX === 'true';
const runId = `fdekit-live-smoke-${new Date().toISOString()}`;

const smokeSpecs = [
  {
    id: 'github',
    requiredEnv: ['GITHUB_TOKEN', 'GITHUB_REPOSITORY'],
    writes: true,
    run: async () => {
      const { githubConnector } = await import('@fdekit/connector-github');
      const connector = githubConnector({
        mode: 'api',
        repository: requireEnv('GITHUB_REPOSITORY'),
        env: process.env,
      });
      const result = await callTool(connector, 'issue.create', {
        title: `[FDEKit live smoke] ${runId}`,
        body: [
          'Automated FDEKit connector smoke test',
          `Run: ${runId}`,
          'Use a sandbox repository for this job',
        ].join('\n'),
        ticketId: runId,
      });

      return summarize(result, ['number', 'url', 'id']);
    },
  },
  {
    id: 'slack',
    requiredEnv: ['SLACK_BOT_TOKEN', 'SLACK_CHANNEL_ID'],
    writes: true,
    run: async () => {
      const { slackConnector } = await import('@fdekit/connector-slack');
      const connector = slackConnector({
        mode: 'api',
        defaultChannel: requireEnv('SLACK_CHANNEL_ID'),
        env: process.env,
      });
      const result = await callTool(connector, 'slack.message', {
        text: `FDEKit live connector smoke test ${runId}`,
        ticketId: runId,
      });

      return summarize(result, ['channel', 'ts']);
    },
  },
  {
    id: 'jira',
    requiredEnv: ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'],
    writes: true,
    run: async () => {
      const { jiraConnector } = await import('@fdekit/connector-jira');
      const connector = jiraConnector({
        mode: 'api',
        baseUrl: requireEnv('JIRA_BASE_URL'),
        projectKey: requireEnv('JIRA_PROJECT_KEY'),
        env: process.env,
      });
      const result = await callTool(connector, 'jira.issue.create', {
        summary: `[FDEKit live smoke] ${runId}`,
        body: 'Automated FDEKit connector smoke test against a sandbox Jira project',
        ticketId: runId,
      });

      return summarize(result, ['key', 'url', 'id']);
    },
  },
  {
    id: 'linear',
    requiredEnv: ['LINEAR_API_KEY', 'LINEAR_TEAM_ID'],
    writes: true,
    run: async () => {
      const { linearConnector } = await import('@fdekit/connector-linear');
      const connector = linearConnector({
        mode: 'api',
        teamId: requireEnv('LINEAR_TEAM_ID'),
        env: process.env,
      });
      const result = await callTool(connector, 'linear.issue.create', {
        title: `[FDEKit live smoke] ${runId}`,
        body: 'Automated FDEKit connector smoke test against a sandbox Linear team',
        ticketId: runId,
      });

      return summarize(result, ['identifier', 'url', 'id']);
    },
  },
  {
    id: 'hubspot',
    requiredEnv: ['HUBSPOT_ACCESS_TOKEN'],
    writes: true,
    run: async () => {
      const { hubspotConnector } = await import('@fdekit/connector-hubspot');
      const connector = hubspotConnector({
        mode: 'api',
        portalId: process.env.HUBSPOT_PORTAL_ID,
        env: process.env,
      });
      const result = await callTool(connector, 'hubspot.note.create', {
        title: `[FDEKit live smoke] ${runId}`,
        body: 'Automated FDEKit connector smoke test against a sandbox HubSpot portal',
        timestamp: new Date().toISOString(),
      });

      return summarize(result, ['id', 'url']);
    },
  },
  {
    id: 'salesforce',
    requiredEnv: ['SALESFORCE_INSTANCE_URL', 'SALESFORCE_ACCESS_TOKEN'],
    writes: true,
    run: async () => {
      const { salesforceConnector } = await import('@fdekit/connector-salesforce');
      const connector = salesforceConnector({
        mode: 'api',
        instanceUrl: requireEnv('SALESFORCE_INSTANCE_URL'),
        defaultWhatId: process.env.SALESFORCE_ACCOUNT_ID,
        env: process.env,
      });
      const result = await callTool(connector, 'salesforce.task.create', {
        subject: `[FDEKit live smoke] ${runId}`,
        body: 'Automated FDEKit connector smoke test against a sandbox Salesforce org',
        status: 'Completed',
        priority: 'Normal',
      });

      return summarize(result, ['id', 'url']);
    },
  },
];

const results = [];

console.log('FDEKit live connector smoke tests');
console.log(`Run: ${runId}`);
console.log(`Connectors: ${selectedConnectors ? [...selectedConnectors].join(', ') : 'all configured connectors'}`);
console.log('');

for (const spec of smokeSpecs) {
  if (selectedConnectors && !selectedConnectors.has(spec.id)) {
    continue;
  }

  const missingEnv = spec.requiredEnv.filter((name) => !process.env[name]);

  if (missingEnv.length > 0) {
    results.push({ id: spec.id, status: 'skipped', reason: `missing ${missingEnv.join(', ')}` });
    continue;
  }

  if (spec.writes && !sandboxAcknowledged) {
    results.push({
      id: spec.id,
      status: 'skipped',
      reason: 'set FDEKIT_LIVE_SMOKE_SANDBOX=true to acknowledge sandbox write targets',
    });
    continue;
  }

  const startedAt = Date.now();

  try {
    const details = await spec.run();
    results.push({
      id: spec.id,
      status: 'passed',
      durationMs: Date.now() - startedAt,
      details,
    });
  } catch (error) {
    results.push({
      id: spec.id,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

const passed = results.filter((result) => result.status === 'passed');
const failed = results.filter((result) => result.status === 'failed');
const skipped = results.filter((result) => result.status === 'skipped');

for (const result of results) {
  const label = result.status.toUpperCase().padEnd(7);
  const duration = typeof result.durationMs === 'number' ? ` ${result.durationMs}ms` : '';
  const suffix = result.details
    ? ` ${formatDetails(result.details)}`
    : result.reason
      ? ` ${result.reason}`
      : '';

  console.log(`${label} ${result.id}${duration}${suffix}`);
}

console.log('');
console.log(`Summary: ${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped`);

if (failed.length > 0) {
  process.exitCode = 1;
} else if (passed.length === 0 && requireAtLeastOne) {
  console.error('No live connector smoke tests ran');
  process.exitCode = 1;
}

async function callTool(connector, toolName, input) {
  const tool = connector.tools.find((candidate) => candidate.name === toolName);

  if (!tool) {
    throw new Error(`Tool ${toolName} not found on connector ${connector.name}`);
  }

  return tool.handler(input);
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }

  return value;
}

function summarize(value, keys) {
  const record = asRecord(value);
  const summary = {};

  for (const key of keys) {
    const item = record[key];

    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      summary[key] = String(item);
    }
  }

  return summary;
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function formatDetails(details) {
  return Object.entries(details)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
}

function parseConnectorFilter(value) {
  const names = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return names.length > 0 ? new Set(names) : null;
}
