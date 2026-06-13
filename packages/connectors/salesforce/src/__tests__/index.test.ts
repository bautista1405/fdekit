import { describe, expect, it } from 'vitest';
import { salesforceConnector } from '../index.js';

describe('salesforceConnector', () => {
  it('creates deterministic local Salesforce tasks through native and common tools', async () => {
    const connector = salesforceConnector({ defaultWhatId: '001LOCAL' });
    const tool = connector.tools?.find((candidate) => candidate.name === 'salesforce.task.create');
    const commonTool = connector.tools?.find((candidate) => candidate.name === 'crm.note.create');

    await expect(tool?.handler({
      accountId: 'acct_company',
      title: 'Sales research brief for company Cloud',
      summary: 'Lead with renewal risk',
      nextStep: 'Send a tailored opener',
    }, {})).resolves.toEqual({
      id: 'local_salesforce_task_1',
      mode: 'local',
      provider: 'salesforce',
      subject: 'Sales research brief for company Cloud',
      body: 'Lead with renewal risk\n\nNext step: Send a tailored opener',
      accountId: 'acct_company',
      whatId: '001LOCAL',
      url: 'https://salesforce.local/lightning/r/Task/local_salesforce_task_1/view',
    });

    await expect(commonTool?.handler({
      accountId: 'acct_nova',
      body: 'Operations team is evaluating automation',
    }, {})).resolves.toMatchObject({
      id: 'local_salesforce_task_2',
      mode: 'local',
      provider: 'salesforce',
      accountId: 'acct_nova',
      whatId: '001LOCAL',
    });
  });

  it('creates Salesforce tasks through REST API mode', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = salesforceConnector({
      mode: 'api',
      instanceUrl: 'https://company.my.salesforce.com/',
      apiVersion: '61.0',
      accessTokenEnv: 'TEST_SALESFORCE_TOKEN',
      defaultWhatIdEnv: 'TEST_SALESFORCE_ACCOUNT_ID',
      env: {
        TEST_SALESFORCE_TOKEN: 'sf-token',
        TEST_SALESFORCE_ACCOUNT_ID: '001TEST',
      },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({
          id: '00T123',
          success: true,
          errors: [],
        }, { status: 201 });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'crm.note.create');

    await expect(tool?.handler({
      accountId: 'acct_company',
      title: 'Sales research brief for company Cloud',
      summary: 'Lead with renewal risk',
      ownerId: '005OWNER',
      activityDate: '2026-05-26',
    }, {})).resolves.toMatchObject({
      id: '00T123',
      mode: 'api',
      provider: 'salesforce',
      accountId: 'acct_company',
      whatId: '001TEST',
      url: 'https://company.my.salesforce.com/lightning/r/Task/00T123/view',
    });
    expect(calls[0].input).toBe('https://company.my.salesforce.com/services/data/v61.0/sobjects/Task/');
    expect(calls[0].init?.headers).toMatchObject({
      accept: 'application/json',
      authorization: 'Bearer sf-token',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      Subject: 'Sales research brief for company Cloud',
      Description: 'Lead with renewal risk',
      WhatId: '001TEST',
      OwnerId: '005OWNER',
      Status: 'Completed',
      Priority: 'Normal',
      ActivityDate: '2026-05-26',
    });
  });

  it('requires Salesforce instance URL and access token in API mode', async () => {
    const missingInstanceUrl = salesforceConnector({
      mode: 'api',
      env: {},
      fetch: async () => Response.json({ id: '00T123', success: true }),
    }).tools?.find((candidate) => candidate.name === 'crm.note.create');

    await expect(missingInstanceUrl?.handler({
      title: 'Sales research brief for company Cloud',
    }, {})).rejects.toThrow('Missing Salesforce instance URL');

    const missingToken = salesforceConnector({
      mode: 'api',
      instanceUrl: 'https://company.my.salesforce.com',
      env: {},
      fetch: async () => Response.json({ id: '00T123', success: true }),
    }).tools?.find((candidate) => candidate.name === 'crm.note.create');

    await expect(missingToken?.handler({
      title: 'Sales research brief for company Cloud',
    }, {})).rejects.toThrow('Missing Salesforce access token');
  });
});
