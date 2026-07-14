import {
  asRecord,
  getString,
  requestConnectorJson,
  requireEnvValue,
} from '@fdekit/core';

export { asRecord, getString, normalizeBaseUrl, readEnvValue } from '@fdekit/core';

export async function postSlackMessage(options: {
  apiBaseUrl: string;
  token: string;
  fetchImpl: typeof globalThis.fetch;
  channel: string;
  text: string;
}): Promise<unknown> {
  return requestConnectorJson({
    connectorName: 'slackConnector API mode',
    fetchImpl: options.fetchImpl,
    url: `${options.apiBaseUrl}/chat.postMessage`,
    init: {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify({
        channel: options.channel,
        text: options.text,
      }),
    },
    defaultHeaders: {
      'content-type': 'application/json; charset=utf-8',
    },
    isSuccessful: (value) => asRecord(value).ok !== false,
    errorMessage: (value, response) => {
      const reason = getString(asRecord(value).error) ?? `${response.status} ${response.statusText}`;
      return `Slack chat.postMessage failed: ${reason}`;
    },
  });
}

const maxRenderedFindings = 5;

/**
 * Renders the reviewer-triage card deterministically from structured fields,
 * so every notification has the same shape regardless of which model produced
 * the review.
 */
export function renderReviewNotification(args: {
  title: string;
  recommendation: 'comment' | 'request-changes';
  prUrl: string;
  ticketUrl?: string;
  findingsSummary?: string[];
  riskReasons?: string[];
}): string {
  const findings = args.findingsSummary ?? [];
  const overflow = findings.length - maxRenderedFindings;
  const lines = [
    `*PR review ready:* ${args.title}`,
    `*Recommendation:* ${args.recommendation === 'request-changes' ? ':warning: request changes' : ':speech_balloon: comment'}`,
    ...(args.riskReasons?.length ? [`*Risk:* ${args.riskReasons.join(', ')}`] : []),
    ...findings.slice(0, maxRenderedFindings).map((finding) => `• ${finding}`),
    ...(overflow > 0 ? [`…and ${overflow} more finding(s)`] : []),
    `<${args.prUrl}|Review on GitHub>${args.ticketUrl ? ` · <${args.ticketUrl}|Ticket>` : ''}`,
  ];

  return lines.join('\n');
}

export function requireToken(tokenEnv: string, env?: Record<string, string | undefined>): string {
  return requireEnvValue(
    tokenEnv,
    `Missing Slack token; set ${tokenEnv} or use slackConnector({ mode: 'local' })`,
    env,
  );
}
