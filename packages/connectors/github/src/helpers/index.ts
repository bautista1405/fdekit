import {
  asRecord,
  getString,
  requestConnectorJson,
  requireEnvValue,
} from '@fdekit/core';
import type { TicketRef } from '../interfaces/index.js';

export { asRecord, getNumber, getString, normalizeBaseUrl, readEnvValue } from '@fdekit/core';

export async function createGitHubIssue(options: {
  apiBaseUrl: string;
  token: string;
  fetchImpl: typeof globalThis.fetch;
  repository: string;
  title: string;
  body: string;
  labels: string[];
}): Promise<unknown> {
  return requestConnectorJson({
    connectorName: 'githubConnector API mode',
    fetchImpl: options.fetchImpl,
    url: `${options.apiBaseUrl}/repos/${options.repository}/issues`,
    init: {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.token}`,
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({
        title: options.title,
        body: options.body,
        labels: options.labels,
      }),
    },
    defaultHeaders: {
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
    errorMessage: (value, response) => {
      const message = getString(asRecord(value).message) ?? `${response.status} ${response.statusText}`;
      return `GitHub issue creation failed: ${message}`;
    },
  });
}

export function requireToken(tokenEnv: string, env?: Record<string, string | undefined>): string {
  return requireEnvValue(
    tokenEnv,
    `Missing GitHub token; set ${tokenEnv} or use githubConnector({ mode: 'local' })`,
    env,
  );
}

/**
 * Extracts ticket references from PR text: issue-tracker keys (ENG-123 style,
 * Linear and Jira share the format), GitHub issue references (#42), and URLs.
 */
export function extractTicketRefs(text: string): TicketRef[] {
  const refs = new Map<string, TicketRef>();

  for (const match of text.matchAll(/\b[A-Z][A-Z0-9]{1,9}-\d+\b/g)) {
    refs.set(match[0], { kind: 'issue-key', ref: match[0] });
  }

  for (const match of text.matchAll(/(?:^|[\s(])#(\d+)\b/g)) {
    refs.set(`#${match[1]}`, { kind: 'github-issue', ref: match[1] });
  }

  for (const match of text.matchAll(/https?:\/\/[^\s)>\]]+/g)) {
    const ref = match[0].replace(/[.,;]+$/, '');
    refs.set(ref, { kind: 'url', ref });
  }

  return Array.from(refs.values());
}

const githubGetHeaders = {
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
};

const githubPostHeaders = {
  ...githubGetHeaders,
  'content-type': 'application/json',
};

export async function fetchGitHubPr(options: {
  apiBaseUrl: string;
  token: string;
  fetchImpl: typeof globalThis.fetch;
  repository: string;
  number: number;
}): Promise<unknown> {
  return requestConnectorJson({
    connectorName: 'githubConnector API mode',
    fetchImpl: options.fetchImpl,
    url: `${options.apiBaseUrl}/repos/${options.repository}/pulls/${options.number}`,
    init: {
      headers: {
        authorization: `Bearer ${options.token}`,
      },
    },
    defaultHeaders: githubGetHeaders,
    errorMessage: (value, response) => {
      const message = getString(asRecord(value).message) ?? `${response.status} ${response.statusText}`;
      return `GitHub pull request fetch failed: ${message}`;
    },
  });
}

export async function fetchGitHubPrFiles(options: {
  apiBaseUrl: string;
  token: string;
  fetchImpl: typeof globalThis.fetch;
  repository: string;
  number: number;
}): Promise<unknown> {
  return requestConnectorJson({
    connectorName: 'githubConnector API mode',
    fetchImpl: options.fetchImpl,
    url: `${options.apiBaseUrl}/repos/${options.repository}/pulls/${options.number}/files?per_page=100`,
    init: {
      headers: {
        authorization: `Bearer ${options.token}`,
      },
    },
    defaultHeaders: githubGetHeaders,
    errorMessage: (value, response) => {
      const message = getString(asRecord(value).message) ?? `${response.status} ${response.statusText}`;
      return `GitHub pull request files fetch failed: ${message}`;
    },
  });
}

export async function postGitHubReview(options: {
  apiBaseUrl: string;
  token: string;
  fetchImpl: typeof globalThis.fetch;
  repository: string;
  number: number;
  event: 'COMMENT' | 'REQUEST_CHANGES';
  body: string;
  comments: Array<{ path: string; line: number; side: string; body: string }>;
}): Promise<unknown> {
  return requestConnectorJson({
    connectorName: 'githubConnector API mode',
    fetchImpl: options.fetchImpl,
    url: `${options.apiBaseUrl}/repos/${options.repository}/pulls/${options.number}/reviews`,
    init: {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify({
        event: options.event,
        body: options.body,
        comments: options.comments,
      }),
    },
    defaultHeaders: githubPostHeaders,
    errorMessage: (value, response) => {
      const message = getString(asRecord(value).message) ?? `${response.status} ${response.statusText}`;
      return `GitHub review post failed: ${message}`;
    },
  });
}

export async function postGitHubReviewReply(options: {
  apiBaseUrl: string;
  token: string;
  fetchImpl: typeof globalThis.fetch;
  repository: string;
  number: number;
  commentId: number;
  body: string;
}): Promise<unknown> {
  return requestConnectorJson({
    connectorName: 'githubConnector API mode',
    fetchImpl: options.fetchImpl,
    url: `${options.apiBaseUrl}/repos/${options.repository}/pulls/${options.number}/comments/${options.commentId}/replies`,
    init: {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify({ body: options.body }),
    },
    defaultHeaders: githubPostHeaders,
    errorMessage: (value, response) => {
      const message = getString(asRecord(value).message) ?? `${response.status} ${response.statusText}`;
      return `GitHub review reply failed: ${message}`;
    },
  });
}
