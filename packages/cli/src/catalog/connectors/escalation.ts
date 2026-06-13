import type { ConnectorManifest } from '../types.js';
import { fdekitDependency } from '../../package-versions.js';
import { connectorModeEnv } from './shared.js';

export const escalationConnectorManifests: ConnectorManifest[] = [
  {
    kind: 'connector',
    id: 'slack',
    displayName: 'Slack',
    packageName: '@fdekit/connector-slack',
    configFactory: 'slackConnector()',
    tools: ['slack.message'],
    maturity: 'Beta',
    supportNote: 'Supports demo/local mode and API mode for posting escalation messages with mocked contract coverage',
    packagePurpose: 'Local/API Slack-style messaging',
    systemDependency: 'API mode uses HTTPS plus `SLACK_BOT_TOKEN` and `SLACK_CHANNEL_ID`',
    scaffold: {
      key: 'slack',
      expression: `slackConnector({
  mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local',
  defaultChannel: process.env.SLACK_CHANNEL_ID ?? '#support-escalations',
  tokenEnv: 'SLACK_BOT_TOKEN',
  channelEnv: 'SLACK_CHANNEL_ID',
})`,
      imports: [
        { moduleName: '@fdekit/connector-slack', names: ['slackConnector'] },
      ],
      dependencies: fdekitDependency('@fdekit/connector-slack'),
      env: [
        connectorModeEnv,
        {
          name: 'SLACK_BOT_TOKEN',
          description: 'Slack bot token for API mode messages',
        },
        {
          name: 'SLACK_CHANNEL_ID',
          value: 'C0123456789',
          description: 'Slack channel ID for support escalations',
        },
      ],
    },
  },
  {
    kind: 'connector',
    id: 'github',
    displayName: 'GitHub',
    packageName: '@fdekit/connector-github',
    configFactory: 'githubConnector()',
    tools: ['issue.create'],
    maturity: 'Beta',
    supportNote: 'Supports demo/local mode and API mode for issue creation with mocked contract coverage',
    packagePurpose: 'Local/API GitHub-style issue creation with common `issue.create`',
    systemDependency: 'API mode uses HTTPS plus `GITHUB_TOKEN` and `GITHUB_REPOSITORY`',
    scaffold: {
      key: 'github',
      expression: `githubConnector({
  mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local',
  repository: process.env.GITHUB_REPOSITORY ?? 'owner/repo',
  tokenEnv: 'GITHUB_TOKEN',
  repositoryEnv: 'GITHUB_REPOSITORY',
})`,
      imports: [
        { moduleName: '@fdekit/connector-github', names: ['githubConnector'] },
      ],
      dependencies: fdekitDependency('@fdekit/connector-github'),
      env: [
        connectorModeEnv,
        {
          name: 'GITHUB_TOKEN',
          description: 'GitHub token for API mode issue creation',
        },
        {
          name: 'GITHUB_REPOSITORY',
          value: 'owner/repo',
          description: 'GitHub repository for escalation issues',
        },
      ],
    },
  },
  {
    kind: 'connector',
    id: 'jira',
    displayName: 'Jira',
    packageName: '@fdekit/connector-jira',
    configFactory: 'jiraConnector()',
    tools: ['jira.issue.create', 'issue.create'],
    maturity: 'Beta',
    supportNote: 'Supports demo/local mode and API mode for issue creation, plus the shared `issue.create` tool pattern',
    packagePurpose: 'Local/API Jira issue creation with common `issue.create`',
    systemDependency: 'API mode uses HTTPS plus `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_PROJECT_KEY`',
    scaffold: {
      key: 'jira',
      expression: `jiraConnector({
  mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local',
  baseUrl: process.env.JIRA_BASE_URL,
  projectKey: process.env.JIRA_PROJECT_KEY,
})`,
      imports: [
        { moduleName: '@fdekit/connector-jira', names: ['jiraConnector'] },
      ],
      dependencies: fdekitDependency('@fdekit/connector-jira'),
      env: [
        connectorModeEnv,
        {
          name: 'JIRA_BASE_URL',
          value: 'https://your-domain.atlassian.net',
          description: 'Jira Cloud site URL for API mode',
        },
        {
          name: 'JIRA_EMAIL',
          description: 'Jira account email for API token authentication',
        },
        {
          name: 'JIRA_API_TOKEN',
          description: 'Jira API token for API mode issue creation',
        },
        {
          name: 'JIRA_PROJECT_KEY',
          value: 'SUP',
          description: 'Jira project key for created issues',
        },
      ],
    },
  },
  {
    kind: 'connector',
    id: 'linear',
    displayName: 'Linear',
    packageName: '@fdekit/connector-linear',
    configFactory: 'linearConnector()',
    tools: ['linear.issue.create', 'issue.create'],
    maturity: 'Beta',
    supportNote: 'Supports demo/local mode and API mode for issue creation, plus the shared `issue.create` tool pattern',
    packagePurpose: 'Local/API Linear issue creation with common `issue.create`',
    systemDependency: 'API mode uses HTTPS plus `LINEAR_API_KEY` and `LINEAR_TEAM_ID`',
    scaffold: {
      key: 'linear',
      expression: `linearConnector({
  mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local',
  teamId: process.env.LINEAR_TEAM_ID,
})`,
      imports: [
        { moduleName: '@fdekit/connector-linear', names: ['linearConnector'] },
      ],
      dependencies: fdekitDependency('@fdekit/connector-linear'),
      env: [
        connectorModeEnv,
        {
          name: 'LINEAR_API_KEY',
          description: 'Linear API key for API mode issue creation',
        },
        {
          name: 'LINEAR_TEAM_ID',
          description: 'Linear team UUID for created issues',
        },
      ],
    },
  },
];
