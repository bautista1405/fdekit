import { describe, expect, it } from 'vitest';
import { slackConnector } from '../index.js';

describe('slackConnector', () => {
  it('returns a local slack.message tool', async () => {
    const connector = slackConnector({
      defaultChannel: '#triage',
      now: () => '2026-05-22T00:00:00.000Z',
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'slack.message');

    expect(await tool?.handler({
      text: 'Escalation needed',
      ticketId: 'tick_1001',
    }, {})).toEqual({
      ok: true,
      mode: 'local',
      channel: '#triage',
      text: 'Escalation needed',
      ticketId: 'tick_1001',
      ts: '2026-05-22T00:00:00.000Z',
    });
  });

  it('posts to Slack chat.postMessage in API mode', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = slackConnector({
      mode: 'api',
      defaultChannel: 'C123',
      apiBaseUrl: 'https://slack.test/api/',
      env: { SLACK_BOT_TOKEN: 'xoxb-test' },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({ ok: true, channel: 'C123', ts: '1779479000.000001' });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'slack.message');

    await expect(tool?.handler({
      text: 'Escalation needed',
      ticketId: 'tick_1001',
    }, {})).resolves.toMatchObject({
      ok: true,
      mode: 'api',
      channel: 'C123',
      text: 'Escalation needed',
      ticketId: 'tick_1001',
      ts: '1779479000.000001',
    });

    expect(calls[0].input).toBe('https://slack.test/api/chat.postMessage');
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.headers).toMatchObject({
      authorization: 'Bearer xoxb-test',
      'content-type': 'application/json; charset=utf-8',
    });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      channel: 'C123',
      text: 'Escalation needed',
    });
  });

  it('requires a Slack token in API mode', async () => {
    const connector = slackConnector({
      mode: 'api',
      env: {},
      fetch: async () => Response.json({ ok: true }),
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'slack.message');

    await expect(tool?.handler({
      channel: 'C123',
      text: 'Escalation needed',
    }, {})).rejects.toThrow('Missing Slack token');
  });
});
