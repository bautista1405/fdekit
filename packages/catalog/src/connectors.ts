import { crmConnectorManifests } from './connectors/crm.js';
import { dataConnectorManifests } from './connectors/data.js';
import { escalationConnectorManifests } from './connectors/escalation.js';
import { workspaceConnectorManifests } from './connectors/workspace.js';
import type { ConnectorManifest } from './types.js';

export const connectorManifests: ConnectorManifest[] = [
  ...workspaceConnectorManifests,
  ...escalationConnectorManifests,
  ...dataConnectorManifests,
  ...crmConnectorManifests,
];
