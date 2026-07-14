import { describe, expect, it } from 'vitest';
import { slackConnector } from '../index.js';

describe('slackConnector', () => {
  it('declares allowed environments on every tool', () => {
    const connector = slackConnector();

    for (const tool of connector.tools ?? []) {
      expect(tool.environments).toEqual(['local', 'development', 'staging']);
    }
  });

  it('renders the reviewer card deterministically in local mode', async () => {
    const connector = slackConnector({ now: () => '2026-07-06T00:00:00.000Z' });
    const tool = connector.tools?.find((candidate) => candidate.name === 'slack.notify');

    const result = await tool?.handler({
      title: 'Add retry handling to billing sync',
      recommendation: 'request-changes',
      prUrl: 'https://github.com/company/app/pull/7',
      ticketUrl: 'https://linear.app/team/issue/ENG-123',
      findingsSummary: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'],
      riskReasons: ['high fan-in (7 importers)', 'sensitive path'],
    }, {}) as { text: string; ok: boolean; channel: string };

    expect(result.ok).toBe(true);
    expect(result.channel).toBe('#support-escalations');
    expect(result.text).toContain('*PR review ready:* Add retry handling to billing sync');
    expect(result.text).toContain(':warning: request changes');
    expect(result.text).toContain('*Risk:* high fan-in (7 importers), sensitive path');
    expect(result.text).toContain('• f5');
    expect(result.text).not.toContain('• f6');
    expect(result.text).toContain('…and 2 more finding(s)');
    expect(result.text).toContain('<https://github.com/company/app/pull/7|Review on GitHub> · <https://linear.app/team/issue/ENG-123|Ticket>');

    await expect(tool?.handler({
      title: '',
      recommendation: 'comment',
      prUrl: 'https://github.com/company/app/pull/7',
    }, {})).rejects.toThrow('non-empty title');
    await expect(tool?.handler({
      title: 'x',
      recommendation: 'approve',
      prUrl: 'https://github.com/company/app/pull/7',
    } as never, {})).rejects.toThrow('must be "comment" or "request-changes"');
  });

  it('posts the reviewer card through chat.postMessage in API mode', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = slackConnector({
      mode: 'api',
      env: {
        SLACK_BOT_TOKEN: 'xoxb-test',
        SLACK_CHANNEL_ID: 'C123',
      },
      fetch: async (input, init) => {
        calls.push({ input, init });

        return Response.json({ ok: true, ts: '1710000000.000200' });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'slack.notify');

    await expect(tool?.handler({
      title: 'Add retry handling',
      recommendation: 'comment',
      prUrl: 'https://github.com/company/app/pull/7',
    }, {})).resolves.toMatchObject({
      ok: true,
      channel: 'C123',
      ts: '1710000000.000200',
    });

    expect(String(calls[0].input)).toBe('https://slack.com/api/chat.postMessage');
    const body = JSON.parse(String(calls[0].init?.body)) as { channel: string; text: string };
    expect(body.channel).toBe('C123');
    expect(body.text).toContain(':speech_balloon: comment');
  });

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

  it('defaults the API channel from SLACK_CHANNEL_ID', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const connector = slackConnector({
      mode: 'api',
      apiBaseUrl: 'https://slack.test/api/',
      env: {
        SLACK_BOT_TOKEN: 'xoxb-test',
        SLACK_CHANNEL_ID: 'C999',
      },
      fetch: async (input, init) => {
        calls.push({ input, init });
        return Response.json({ ok: true, channel: 'C999', ts: '1779479000.000002' });
      },
    });
    const tool = connector.tools?.find((candidate) => candidate.name === 'slack.message');

    expect(connector.config.defaultChannel).toBe('C999');
    await expect(tool?.handler({
      text: 'Escalation needed',
      ticketId: 'tick_1002',
    }, {})).resolves.toMatchObject({
      ok: true,
      mode: 'api',
      channel: 'C999',
      text: 'Escalation needed',
      ticketId: 'tick_1002',
    });

    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      channel: 'C999',
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
