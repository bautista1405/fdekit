import { createHttpReq, defineConnector, defineTool, type ConnectorDefinition } from '@fdekit/core';
import {
  asRecord,
  createSalesforceTask,
  formatTaskBody,
  getString,
  normalizeApiVersion,
  normalizeBaseUrl,
  readEnvValue,
  requireToken,
} from './helpers/index.js';
import type { CreateSalesforceTaskArgs, CreateSalesforceTaskResult, SalesforceConnectorConfig, SalesforceConnectorMode, SalesforceConnectorOptions } from './interfaces/index.js';
export type { CreateSalesforceTaskArgs, CreateSalesforceTaskResult, SalesforceConnectorConfig, SalesforceConnectorMode, SalesforceConnectorOptions } from './interfaces/index.js';

const createSalesforceTaskArgsSchema = {
  type: 'object',
  properties: {
    accountId: {
      type: 'string',
      description: 'Optional FDEKit/customer account id for traceability',
    },
    whatId: {
      type: 'string',
      description: 'Optional Salesforce Account, Opportunity, or other related record id',
    },
    whoId: {
      type: 'string',
      description: 'Optional Salesforce Lead or Contact id',
    },
    ownerId: {
      type: 'string',
      description: 'Optional Salesforce owner id',
    },
    title: {
      type: 'string',
      description: 'Common note title; use this or subject',
    },
    subject: {
      type: 'string',
      description: 'Salesforce Task subject; use this or title',
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
    status: {
      type: 'string',
      description: 'Optional Salesforce Task status; defaults to Completed',
    },
    priority: {
      type: 'string',
      description: 'Optional Salesforce Task priority; defaults to Normal',
    },
    activityDate: {
      type: 'string',
      description: 'Optional Salesforce Task ActivityDate in YYYY-MM-DD format',
    },
    fields: {
      type: 'object',
      description: 'Advanced Salesforce Task fields override',
    },
  },
};

export function salesforceConnector(options: SalesforceConnectorOptions = {}): ConnectorDefinition<SalesforceConnectorConfig> {
  const mode = options.mode ?? 'local';
  const instanceUrlEnv = options.instanceUrlEnv ?? 'SALESFORCE_INSTANCE_URL';
  const accessTokenEnv = options.accessTokenEnv ?? 'SALESFORCE_ACCESS_TOKEN';
  const defaultWhatIdEnv = options.defaultWhatIdEnv ?? 'SALESFORCE_ACCOUNT_ID';
  const apiVersion = normalizeApiVersion(options.apiVersion ?? readEnvValue('SALESFORCE_API_VERSION', options.env) ?? 'v60.0');
  const instanceUrl = options.instanceUrl ? normalizeBaseUrl(options.instanceUrl) : undefined;
  const http = createHttpReq(options.resilience);
  const fetchImpl = ((input, init) => http.request(options.fetch ?? globalThis.fetch, input, init)) as typeof globalThis.fetch;
  let localTaskCounter = 0;

  const createTask = async (args: CreateSalesforceTaskArgs): Promise<CreateSalesforceTaskResult> => {
    localTaskCounter += 1;
    const subject = args.subject ?? args.title ?? 'FDEKit CRM note';
    const body = formatTaskBody(args);
    const whatId = args.whatId ?? options.defaultWhatId ?? readEnvValue(defaultWhatIdEnv, options.env);

    if (!body) {
      throw new Error('salesforce.task.create requires summary, body, note, title, subject, or nextStep');
    }

    if (mode === 'api') {
      const siteUrl = instanceUrl ?? readEnvValue(instanceUrlEnv, options.env);

      if (!siteUrl) {
        throw new Error(`Missing Salesforce instance URL; set ${instanceUrlEnv} or pass salesforceConnector({ instanceUrl })`);
      }

      const normalizedInstanceUrl = normalizeBaseUrl(siteUrl);
      const response = await createSalesforceTask({
        instanceUrl: normalizedInstanceUrl,
        accessToken: requireToken(accessTokenEnv, options.env),
        apiVersion,
        fetchImpl,
        fields: {
          Subject: subject,
          Description: body,
          WhatId: whatId,
          WhoId: args.whoId,
          OwnerId: args.ownerId,
          Status: args.status ?? 'Completed',
          Priority: args.priority ?? 'Normal',
          ActivityDate: args.activityDate,
          ...args.fields,
        },
      });
      const record = asRecord(response);
      const id = getString(record.id) ?? `salesforce_task_${localTaskCounter}`;

      return {
        id,
        mode,
        provider: 'salesforce',
        subject,
        body,
        accountId: args.accountId,
        whatId,
        url: `${normalizedInstanceUrl}/lightning/r/Task/${id}/view`,
        response,
      };
    }

    const id = `local_salesforce_task_${localTaskCounter}`;

    return {
      id,
      mode,
      provider: 'salesforce',
      subject,
      body,
      accountId: args.accountId,
      whatId,
      url: `https://salesforce.local/lightning/r/Task/${id}/view`,
    };
  };

  return defineConnector({
    name: 'salesforce',
    description: 'Create Salesforce CRM tasks/activities; local mode returns deterministic tasks; API mode calls Salesforce REST',
    config: {
      mode,
      instanceUrl,
      instanceUrlEnv,
      accessTokenEnv,
      apiVersion,
      defaultWhatId: options.defaultWhatId,
      defaultWhatIdEnv,
    },
    env: mode === 'api'
      ? [
        {
          name: instanceUrlEnv,
          required: !instanceUrl,
          description: 'Salesforce instance URL, for example https://company.my.salesforce.com',
        },
        {
          name: accessTokenEnv,
          required: true,
          description: 'Salesforce OAuth access token used to create Task records',
        },
        {
          name: 'SALESFORCE_API_VERSION',
          required: false,
          description: 'Optional Salesforce REST API version override',
        },
        {
          name: defaultWhatIdEnv,
          required: false,
          description: 'Optional default Salesforce Account/Opportunity id for crm.note.create',
        },
      ]
      : [],
    tools: [
      defineTool<CreateSalesforceTaskArgs, CreateSalesforceTaskResult>({
        name: 'salesforce.task.create',
        description: 'Create a Salesforce Task activity from an agent handoff',
        scopes: ['crm:write'],
        category: 'crm',
        tags: ['action', 'crm-handoff', 'crm'],
        argsSchema: createSalesforceTaskArgsSchema,
        handler: createTask,
      }),
      defineTool<CreateSalesforceTaskArgs, CreateSalesforceTaskResult>({
        name: 'crm.note.create',
        description: 'Create a CRM note in Salesforce using the common crm.note.create capability',
        scopes: ['crm:write'],
        category: 'crm',
        tags: ['action', 'crm-handoff', 'crm'],
        argsSchema: createSalesforceTaskArgsSchema,
        handler: createTask,
      }),
    ],
  });
}
