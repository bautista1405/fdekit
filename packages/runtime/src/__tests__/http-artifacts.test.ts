import { describe, expect, it } from 'vitest';
import {
  ArtifactIngestError,
  ArtifactProtocolError,
  createHttpArtifactStore,
  HTTP_ARTIFACT_PROTOCOL_VERSION,
} from '../artifact-store/index.js';

interface FetchCall {
  url: string;
  init?: RequestInit;
}

const producer = { name: 'test-worker', version: '1.2.3' };

describe('HTTP artifact store', () => {
  it('sends versioned put and append envelopes with scoped bearer credentials', async () => {
    const calls: FetchCall[] = [];
    const fetchImpl = recordingFetch(calls, () => new Response(null, { status: 204 }));
    const store = createHttpArtifactStore({
      endpoint: 'https://control.example.test/api/ingest/',
      token: 'worker-token',
      producer,
      fetchImpl,
    });

    const jsonRef = { group: 'review runs', fileName: 'run 1.json' };
    await store.writeJson(jsonRef, { id: 'run_1' });
    await store.writeText({ group: 'reports', fileName: 'latest.md' }, '# Report');
    await store.appendJsonl({ group: 'audit', fileName: 'audit.jsonl' }, { id: 'event_1' });

    expect(store.uri(jsonRef)).toBe(
      'https://control.example.test/api/ingest/artifacts/review%20runs/run%201.json',
    );
    expect(calls.map((call) => call.url)).toEqual([
      'https://control.example.test/api/ingest/artifacts',
      'https://control.example.test/api/ingest/artifacts',
      'https://control.example.test/api/ingest/artifacts/append',
    ]);

    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers).toMatchObject({
      authorization: 'Bearer worker-token',
      'content-type': 'application/json',
      'x-fdekit-artifact-protocol': String(HTTP_ARTIFACT_PROTOCOL_VERSION),
      'x-fdekit-artifact-producer': 'test-worker@1.2.3',
    });
    expect(requestBody(calls[0])).toEqual({
      protocolVersion: 1,
      producer,
      operation: 'put',
      group: 'review runs',
      fileName: 'run 1.json',
      encoding: 'json',
      contents: '{"id":"run_1"}',
    });
    expect(requestBody(calls[1])).toMatchObject({
      protocolVersion: 1,
      producer,
      operation: 'put',
      encoding: 'text',
      contents: '# Report',
    });
    expect(requestBody(calls[2])).toEqual({
      protocolVersion: 1,
      producer,
      operation: 'append',
      group: 'audit',
      fileName: 'audit.jsonl',
      encoding: 'jsonl',
      line: '{"id":"event_1"}',
    });
  });

  it('reads JSON, listings, text, and JSONL while isolating malformed list entries', async () => {
    const responses = [
      jsonResponse({ protocolVersion: 1, contents: '{"id":"run_1"}' }),
      jsonResponse({
        protocolVersion: 1,
        artifacts: [
          { contents: '{"id":"run_1"}' },
          { contents: 'not-json' },
          { contents: '{"id":"run_2"}' },
        ],
      }),
      jsonResponse({ protocolVersion: 1, contents: 'hello' }),
      jsonResponse({ protocolVersion: 1, contents: '{"id":1}\ninvalid\n{"id":2}\n' }),
    ];
    const store = createHttpArtifactStore({
      endpoint: 'https://control.example.test/api/ingest',
      token: 'worker-token',
      producer,
      fetchImpl: sequenceFetch(responses),
    });

    await expect(store.readJson({ group: 'runs', fileName: 'run.json' })).resolves.toEqual({ id: 'run_1' });
    await expect(store.listJson('runs')).resolves.toEqual([{ id: 'run_1' }, { id: 'run_2' }]);
    await expect(store.readText({ group: 'reports', fileName: 'latest.md' })).resolves.toBe('hello');
    await expect(store.readJsonl({ group: 'audit', fileName: 'audit.jsonl' })).resolves.toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it('treats a missing artifact as null', async () => {
    const store = createHttpArtifactStore({
      endpoint: 'https://control.example.test/api/ingest',
      token: 'worker-token',
      fetchImpl: sequenceFetch([new Response(null, { status: 404 })]),
    });

    await expect(store.readJson({ group: 'runs', fileName: 'missing.json' })).resolves.toBeNull();
  });

  it('surfaces authentication and server failures', async () => {
    const unauthorized = createHttpArtifactStore({
      endpoint: 'https://control.example.test/api/ingest',
      token: 'bad-token',
      fetchImpl: sequenceFetch([new Response(null, { status: 401 })]),
    });
    const unavailable = createHttpArtifactStore({
      endpoint: 'https://control.example.test/api/ingest',
      token: 'worker-token',
      fetchImpl: sequenceFetch([new Response(null, { status: 503 })]),
    });

    await expect(unauthorized.writeJson({ group: 'runs', fileName: 'run.json' }, {}))
      .rejects.toMatchObject<Partial<ArtifactIngestError>>({ status: 401 });
    await expect(unavailable.readText({ group: 'reports', fileName: 'latest.md' }))
      .rejects.toMatchObject<Partial<ArtifactIngestError>>({ status: 503 });
  });

  it('rejects explicitly incompatible response protocol versions', async () => {
    const store = createHttpArtifactStore({
      endpoint: 'https://control.example.test/api/ingest',
      token: 'worker-token',
      fetchImpl: sequenceFetch([jsonResponse({ protocolVersion: 2, contents: '{}' })]),
    });

    await expect(store.readJson({ group: 'runs', fileName: 'run.json' }))
      .rejects.toBeInstanceOf(ArtifactProtocolError);
  });
});

function recordingFetch(
  calls: FetchCall[],
  responder: (url: string, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return responder(url, init);
  }) as typeof fetch;
}

function sequenceFetch(responses: Response[]): typeof fetch {
  return (async () => {
    const response = responses.shift();

    if (!response) {
      throw new Error('No fake response remains');
    }

    return response;
  }) as typeof fetch;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function requestBody(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>;
}
