import type { ConnectorManifest } from '../types.js';
import { fdekitDependency } from '../../package-versions.js';
import { connectorModeEnv } from './shared.js';

export const crmConnectorManifests: ConnectorManifest[] = [
  {
    kind: 'connector',
    id: 'hubspot',
    displayName: 'HubSpot',
    packageName: '@fdekit/connector-hubspot',
    configFactory: 'hubspotConnector()',
    tools: ['hubspot.note.create', 'crm.note.create'],
    maturity: 'Beta',
    supportNote: 'Supports demo/local mode and API mode for sales-research CRM workflows with mocked contract coverage',
    packagePurpose: 'Local/API HubSpot note creation with common `crm.note.create`',
    systemDependency: 'API mode uses HTTPS plus `HUBSPOT_ACCESS_TOKEN` and optional `HUBSPOT_PORTAL_ID`',
    scaffold: {
      key: 'hubspot',
      expression: `hubspotConnector({
  mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local',
  accessTokenEnv: 'HUBSPOT_ACCESS_TOKEN',
  portalId: process.env.HUBSPOT_PORTAL_ID,
})`,
      imports: [
        { moduleName: '@fdekit/connector-hubspot', names: ['hubspotConnector'] },
      ],
      dependencies: fdekitDependency('@fdekit/connector-hubspot'),
      env: [
        connectorModeEnv,
        {
          name: 'HUBSPOT_ACCESS_TOKEN',
          description: 'HubSpot private app token for API mode CRM notes',
        },
        {
          name: 'HUBSPOT_PORTAL_ID',
          description: 'Optional HubSpot portal id used to build note links',
        },
      ],
    },
  },
  {
    kind: 'connector',
    id: 'salesforce',
    displayName: 'Salesforce',
    packageName: '@fdekit/connector-salesforce',
    configFactory: 'salesforceConnector()',
    tools: ['salesforce.task.create', 'crm.note.create'],
    maturity: 'Beta',
    supportNote: 'Supports demo/local mode and API mode for sales-research CRM workflows with mocked contract coverage',
    packagePurpose: 'Local/API Salesforce task creation with common `crm.note.create`',
    systemDependency: 'API mode uses HTTPS plus `SALESFORCE_INSTANCE_URL` and `SALESFORCE_ACCESS_TOKEN`',
    scaffold: {
      key: 'salesforce',
      expression: `salesforceConnector({
  mode: process.env.FDEKIT_CONNECTOR_MODE === 'api' ? 'api' : 'local',
  instanceUrl: process.env.SALESFORCE_INSTANCE_URL,
  defaultWhatId: process.env.SALESFORCE_ACCOUNT_ID,
})`,
      imports: [
        { moduleName: '@fdekit/connector-salesforce', names: ['salesforceConnector'] },
      ],
      dependencies: fdekitDependency('@fdekit/connector-salesforce'),
      env: [
        connectorModeEnv,
        {
          name: 'SALESFORCE_INSTANCE_URL',
          value: 'https://your-domain.my.salesforce.com',
          description: 'Salesforce instance URL for API mode',
        },
        {
          name: 'SALESFORCE_ACCESS_TOKEN',
          description: 'Salesforce OAuth access token for API mode Task creation',
        },
        {
          name: 'SALESFORCE_API_VERSION',
          value: 'v60.0',
          description: 'Optional Salesforce REST API version override',
        },
        {
          name: 'SALESFORCE_ACCOUNT_ID',
          description: 'Optional default Salesforce Account/Opportunity id for CRM notes',
        },
      ],
    },
  },
];
