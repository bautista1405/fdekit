import type { CatalogEnvVar } from '../types.js';

export const connectorModeEnv: CatalogEnvVar = {
  name: 'FDEKIT_CONNECTOR_MODE',
  value: 'local',
  description: 'Set to api to turn supported external connectors from local mode into live API mode',
};
