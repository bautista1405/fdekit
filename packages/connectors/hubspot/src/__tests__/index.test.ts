import { describe, expect, it } from 'vitest';
import { hubspotConnector } from '../index.js';

describe('hubspotConnector', () => {
  it('creates deterministic local HubSpot notes through native and common tools', async () => {
    const connector = hubspotConnector();
    const tool = connector.tools?.find((candidate) => candidate.name === 'hubspot.note.create');
    const commonTool = connector.tools?.find((candidate) => candidate.name === 'crm.note.create');

    await expect(tool?.handler({
      accountId: 'acct_company',
      title: 'Sales research brief for company Cloud',
      summary: 'Lead with renewal risk',
      nextStep: 'Send a tailored opener',
    }, {})).resolves.toEqual({
      id: 'local_hubspot_note_1',
      mode: 'local',
      provider: 'hubspot',
      title: 'Sales research brief for company Cloud',
      body: 'Sales research brief for company Cloud\n\nLead with renewal risk\n\nNext step: Send a tailored opener',
      accountId: 'acct_company',
      companyId: undefined,
      url: 'https://hubspot.local/notes/1',
    });

    await expect(commonTool?.handler({
      accountId: 'acct_nova',
      body: 'Operations team is evaluating automation',
    }, {})).resolves.toMatchObject({
      id: 'local_hubspot_note_2',
      mode: 'local',
      provider: 'hubspot',
      accountId: 'acct_nova',
    });
  });

  it('creates HubSpot notes through REST API mode', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = hubspotConnector({
      mode: 'api',
      apiBaseUrl: 'https://api.hubspot.test/',
      accessTokenEnv: 'TEST_HUBSPOT_TOKEN',
      portalIdEnv: 'TEST_HUBSPOT_PORTAL',
      env: {
        TEST_HUBSPOT_TOKEN: 'pat-test',
        TEST_HUBSPOT_PORTAL: '12345',
      },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({
          id: 'note_123',
          properties: {
            hs_note_body: 'Sales research brief',
          },
        }, { status: 201 });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'crm.note.create');

    await expect(tool?.handler({
      accountId: 'acct_company',
      title: 'Sales research brief for company Cloud',
      summary: 'Lead with renewal risk',
      ownerId: 'owner_123',
      timestamp: '2026-05-26T12:00:00.000Z',
    }, {})).resolves.toMatchObject({
      id: 'note_123',
      mode: 'api',
      provider: 'hubspot',
      accountId: 'acct_company',
      url: 'https://app.hubspot.com/contacts/12345/record/0-46/note_123',
    });
    expect(calls[0].input).toBe('https://api.hubspot.test/crm/v3/objects/notes');
    expect(calls[0].init?.headers).toMatchObject({
      accept: 'application/json',
      authorization: 'Bearer pat-test',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      properties: {
        hs_note_body: 'Sales research brief for company Cloud\n\nLead with renewal risk',
        hs_timestamp: '2026-05-26T12:00:00.000Z',
        hubspot_owner_id: 'owner_123',
      },
    });
  });

  it('requires a HubSpot access token in API mode', async () => {
    const connector = hubspotConnector({
      mode: 'api',
      env: {},
      fetch: async () => Response.json({ id: 'note_123' }),
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'crm.note.create');

    await expect(tool?.handler({
      title: 'Sales research brief for company Cloud',
    }, {})).rejects.toThrow('Missing HubSpot access token');
  });
});
