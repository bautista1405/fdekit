import { createRequire } from 'module';
import type { ArtifactRef, ArtifactStore } from './types.js';

/**
 * An artifact store backed by an HTTP control plane.
 *
 * Everything the runtime produces as evidence — traces, run summaries, reviews,
 * eval results, audit entries, approvals — is written through `ArtifactStore`,
 * so recipes, agents, and evals do not need transport-specific branches.
 *
 * This adapter sends each operation when it happens, but it is not a durable
 * delivery queue. It has no local spool, retry schedule, or idempotency key yet;
 * process and network failures can still leave evidence undelivered. Callers
 * that need that guarantee must provide it outside this adapter until the
 * durable delivery protocol lands.
 *
 * Failures are surfaced, not swallowed. An artifact store that silently drops
 * writes produces a control plane that looks healthy and is lying, which is
 * worse for a governance tool than an obvious error.
 */

export interface HttpArtifactStoreOptions {
  endpoint: string;
  token: string;
  /** Override producer identity for compatible non-runtime clients and tests. */
  producer?: HttpArtifactProducer;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

export interface HttpArtifactProducer {
  name: string;
  version: string;
}

export const HTTP_ARTIFACT_PROTOCOL_VERSION = 1 as const;

const require = createRequire(import.meta.url);
const runtimePackage = require('../../package.json') as { name?: string; version?: string };

export const HTTP_ARTIFACT_DEFAULT_PRODUCER: HttpArtifactProducer = {
  name: runtimePackage.name ?? '@fdekit/runtime',
  version: runtimePackage.version ?? '0.0.0',
};

export class ArtifactIngestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ArtifactIngestError';
  }
}

export class ArtifactProtocolError extends Error {
  constructor(readonly receivedVersion: unknown) {
    super(
      `Unsupported artifact protocol version ${String(receivedVersion)}; expected ${HTTP_ARTIFACT_PROTOCOL_VERSION}.`,
    );
    this.name = 'ArtifactProtocolError';
  }
}

export function createHttpArtifactStore(options: HttpArtifactStoreOptions): ArtifactStore {
  const base = options.endpoint.replace(/\/$/, '');
  const doFetch = options.fetchImpl ?? fetch;
  const producer = options.producer ?? HTTP_ARTIFACT_DEFAULT_PRODUCER;

  const headers = {
    authorization: `Bearer ${options.token}`,
    accept: 'application/json',
    'content-type': 'application/json',
    'x-fdekit-artifact-protocol': String(HTTP_ARTIFACT_PROTOCOL_VERSION),
    'x-fdekit-artifact-producer': `${producer.name}@${producer.version}`,
  };

  const protocolMetadata = {
    protocolVersion: HTTP_ARTIFACT_PROTOCOL_VERSION,
    producer,
  };

  async function send(
    path: string,
    body: Record<string, unknown>,
    subject: string,
  ): Promise<void> {
    const response = await doFetch(`${base}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new ArtifactIngestError(
        response.status,
        response.status === 401
          ? 'The worker token was rejected by the artifact endpoint.'
          : `Could not write ${subject} (${response.status}).`,
      );
    }
  }

  async function read(query: string): Promise<unknown> {
    const response = await doFetch(`${base}/artifacts?${query}`, {
      headers: { authorization: `Bearer ${options.token}` },
    });

    // A missing artifact is a legitimate answer, not a failure: callers use
    // null to mean "not written yet".
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new ArtifactIngestError(response.status, `Could not read artifact (${response.status}).`);
    }

    const body: unknown = await response.json();

    if (
      body
      && typeof body === 'object'
      && 'protocolVersion' in body
      && body.protocolVersion !== HTTP_ARTIFACT_PROTOCOL_VERSION
    ) {
      throw new ArtifactProtocolError(body.protocolVersion);
    }

    return body;
  }

  function uri(ref: ArtifactRef): string {
    return `${base}/artifacts/${encodeURIComponent(ref.group)}/${encodeURIComponent(ref.fileName)}`;
  }

  return {
    kind: 'http' as ArtifactStore['kind'],
    rootUri: base,
    uri,

    async writeJson(ref, value) {
      await send(
        '/artifacts',
        { ...protocolMetadata, operation: 'put', ...ref, encoding: 'json', contents: JSON.stringify(value) },
        ref.fileName,
      );

      return uri(ref);
    },

    async readJson<T>(ref: ArtifactRef) {
      const body = (await read(
        `group=${encodeURIComponent(ref.group)}&fileName=${encodeURIComponent(ref.fileName)}`,
      )) as { contents?: string } | null;

      return body?.contents ? (JSON.parse(body.contents) as T) : null;
    },

    async listJson<T>(group: string) {
      const body = (await read(`group=${encodeURIComponent(group)}`)) as
        | { artifacts?: Array<{ contents?: string }> }
        | null;

      return (body?.artifacts ?? [])
        .map((entry) => {
          try {
            return entry.contents ? (JSON.parse(entry.contents) as T) : null;
          } catch {
            // One malformed artifact must not take down a whole listing.
            return null;
          }
        })
        .filter((entry): entry is T => entry !== null);
    },

    async writeText(ref, contents) {
      await send(
        '/artifacts',
        { ...protocolMetadata, operation: 'put', ...ref, encoding: 'text', contents },
        ref.fileName,
      );

      return uri(ref);
    },

    async readText(ref) {
      const body = (await read(
        `group=${encodeURIComponent(ref.group)}&fileName=${encodeURIComponent(ref.fileName)}`,
      )) as { contents?: string } | null;

      return body?.contents ?? null;
    },

    async appendJsonl(ref, value) {
      // Append is a distinct operation rather than read-modify-write: audit and
      // trace lines arrive concurrently, and rewriting the whole file would let
      // two writers silently discard each other's entries.
      await send(
        '/artifacts/append',
        { ...protocolMetadata, operation: 'append', ...ref, encoding: 'jsonl', line: JSON.stringify(value) },
        ref.fileName,
      );

      return uri(ref);
    },

    async readJsonl<T>(ref: ArtifactRef) {
      const contents = (await read(
        `group=${encodeURIComponent(ref.group)}&fileName=${encodeURIComponent(ref.fileName)}`,
      )) as { contents?: string } | null;

      return (contents?.contents ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as T;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is T => entry !== null);
    },
  };
}
