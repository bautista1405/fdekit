import type { HttpResilienceOptions } from '@fdekit/core';

export type GitHubConnectorMode = 'local' | 'api';

export interface GitHubConnectorConfig {
  mode: GitHubConnectorMode;
  repository: string;
  tokenEnv?: string;
  repositoryEnv?: string;
  apiBaseUrl?: string;
}

export interface GitHubConnectorOptions {
  mode?: GitHubConnectorMode;
  repository?: string;
  tokenEnv?: string;
  repositoryEnv?: string;
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
  env?: Record<string, string | undefined>;
  resilience?: HttpResilienceOptions;
}

export interface CreateIssueArgs {
  ticketId?: string;
  title: string;
  body: string;
  priority?: string;
  labels?: string[];
}

export interface CreateIssueResult {
  id: string;
  number: number;
  mode: GitHubConnectorMode;
  repository: string;
  title: string;
  body: string;
  priority?: string;
  labels: string[];
  ticketId?: string;
  url: string;
  response?: unknown;
}

export interface TicketRef {
  kind: 'issue-key' | 'github-issue' | 'url';
  ref: string;
}

export interface PrDiffArgs {
  number: number;
  maxFiles?: number;
}

export interface PrListArgs {
  state?: 'open' | 'closed' | 'all';
  maxResults?: number;
}

/**
 * One row of the console's PR inbox. Every string here is authored by a PR
 * author and is therefore attacker-controlled: it must be escaped at render,
 * never interpolated into markup or a prompt without fencing.
 */
export interface PrListItem {
  number: number;
  title: string;
  author: string;
  baseRef: string;
  headRef: string;
  draft: boolean;
  updatedAt: string;
  url: string;
}

export interface PrListResult {
  mode: GitHubConnectorMode;
  repository: string;
  state: 'open' | 'closed' | 'all';
  pullRequests: PrListItem[];
  truncated: boolean;
}

export interface PrDiffFile {
  filePath: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
}

export interface PrDiffResult {
  mode: GitHubConnectorMode;
  repository: string;
  number: number;
  title: string;
  body: string;
  author: string;
  baseRef: string;
  headRef: string;
  additions: number;
  deletions: number;
  files: PrDiffFile[];
  truncated: boolean;
  ticketRefs: TicketRef[];
  url: string;
}

export interface ReviewComment {
  path: string;
  line: number;
  body: string;
}

export interface ReviewPostArgs {
  number: number;
  summary: string;
  recommendation: 'comment' | 'request-changes';
  comments?: ReviewComment[];
}

export interface ReviewPostResult {
  mode: GitHubConnectorMode;
  repository: string;
  number: number;
  event: 'COMMENT' | 'REQUEST_CHANGES';
  commentCount: number;
  url: string;
  response?: unknown;
}

export interface PrReplyArgs {
  number: number;
  commentId: number;
  body: string;
}

export interface PrReplyResult {
  mode: GitHubConnectorMode;
  repository: string;
  number: number;
  commentId: number;
  url: string;
  response?: unknown;
}
