import { createHttpReq, defineConnector, defineTool, type ConnectorDefinition } from '@fdekit/core';
import {
  asRecord,
  compactObject,
  createHubSpotNote,
  formatNoteBody,
  getString,
  hubSpotObjectUrl,
  normalizeBaseUrl,
  readEnvValue,
  requireToken,
} from './helpers/index.js';
import type { CreateHubSpotNoteArgs, CreateHubSpotNoteResult, HubSpotAssociation, HubSpotAssociationType, HubSpotConnectorConfig, HubSpotConnectorMode, HubSpotConnectorOptions } from './interfaces/index.js';
export type { CreateHubSpotNoteArgs, CreateHubSpotNoteResult, HubSpotAssociation, HubSpotAssociationType, HubSpotConnectorConfig, HubSpotConnectorMode, HubSpotConnectorOptions } from './interfaces/index.js';

const createHubSpotNoteArgsSchema = {
  type: 'object',
  properties: {
    accountId: {
      type: 'string',
      description: 'Optional FDEKit/customer account id for traceability',
    },
    companyId: {
      type: 'string',
      description: 'Optional HubSpot company object id',
    },
    contactId: {
      type: 'string',
      description: 'Optional HubSpot contact object id',
    },
    dealId: {
      type: 'string',
      description: 'Optional HubSpot deal object id',
    },
    ownerId: {
      type: 'string',
      description: 'Optional HubSpot owner id',
    },
    title: {
      type: 'string',
      description: 'Short note title',
    },
    summary: {
      type: 'string',
      description: 'CRM note summary; use this, body, or note',
    },
    body: {
      type: 'string',
      description: 'CRM note body; use this, summary, or note',
    },
    note: {
      type: 'string',
      description: 'CRM note body; use this, summary, or body',
    },
    nextStep: {
      type: 'string',
      description: 'Recommended follow-up step',
    },
    timestamp: {
      type: 'string',
      description: 'ISO timestamp for the note; defaults to now',
    },
    associations: {
      type: 'array',
      description: 'Advanced HubSpot associations payload',
    },
    properties: {
      type: 'object',
      description: 'Advanced HubSpot note properties override',
    },
  },
};

export function hubspotConnector(options: HubSpotConnectorOptions = {}): ConnectorDefinition<HubSpotConnectorConfig> {
  const mode = options.mode ?? 'local';
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl ?? 'https://api.hubapi.com');
  const accessTokenEnv = options.accessTokenEnv ?? 'HUBSPOT_ACCESS_TOKEN';
  const portalIdEnv = options.portalIdEnv ?? 'HUBSPOT_PORTAL_ID';
  const http = createHttpReq(options.resilience);
  const fetchImpl = ((input, init) => http.request(options.fetch ?? globalThis.fetch, input, init)) as typeof globalThis.fetch;
  let localNoteCounter = 0;

  const createNote = async (args: CreateHubSpotNoteArgs): Promise<CreateHubSpotNoteResult> => {
    localNoteCounter += 1;
    const body = formatNoteBody(args);

    if (!body) {
      throw new Error('hubspot.note.create requires summary, body, note, title, or nextStep');
    }

    if (mode === 'api') {
      const response = await createHubSpotNote({
        apiBaseUrl,
        token: requireToken(accessTokenEnv, options.env),
        fetchImpl,
        properties: compactObject({
          hs_note_body: body,
          hs_timestamp: args.timestamp ?? new Date().toISOString(),
          hubspot_owner_id: args.ownerId,
          ...args.properties,
        }),
        associations: args.associations,
      });
      const record = asRecord(response);
      const id = getString(record.id) ?? `hubspot_note_${localNoteCounter}`;

      return {
        id,
        mode,
        provider: 'hubspot',
        title: args.title,
        body,
        accountId: args.accountId,
        companyId: args.companyId,
        url: hubSpotObjectUrl(options.portalId ?? readEnvValue(portalIdEnv, options.env), id),
        response,
      };
    }

    const id = `local_hubspot_note_${localNoteCounter}`;

    return {
      id,
      mode,
      provider: 'hubspot',
      title: args.title,
      body,
      accountId: args.accountId,
      companyId: args.companyId,
      url: `https://hubspot.local/notes/${localNoteCounter}`,
    };
  };

  return defineConnector({
    name: 'hubspot',
    description: 'Create HubSpot CRM notes; local mode returns deterministic notes; API mode calls HubSpot CRM REST',
    config: {
      mode,
      apiBaseUrl,
      accessTokenEnv,
      portalId: options.portalId,
      portalIdEnv,
    },
    env: mode === 'api'
      ? [
        {
          name: accessTokenEnv,
          required: true,
          description: 'HubSpot private app access token used to create CRM notes',
        },
        {
          name: portalIdEnv,
          required: false,
          description: 'Optional HubSpot portal id used to build note links',
        },
      ]
      : [],
    tools: [
      defineTool<CreateHubSpotNoteArgs, CreateHubSpotNoteResult>({
        name: 'hubspot.note.create',
        description: 'Create a HubSpot CRM note from an agent handoff',
        scopes: ['crm:write'],
        category: 'crm',
        tags: ['action', 'crm-handoff', 'crm'],
        argsSchema: createHubSpotNoteArgsSchema,
        handler: createNote,
      }),
      defineTool<CreateHubSpotNoteArgs, CreateHubSpotNoteResult>({
        name: 'crm.note.create',
        description: 'Create a CRM note in HubSpot using the common crm.note.create capability',
        scopes: ['crm:write'],
        category: 'crm',
        tags: ['action', 'crm-handoff', 'crm'],
        argsSchema: createHubSpotNoteArgsSchema,
        handler: createNote,
      }),
    ],
  });
}
