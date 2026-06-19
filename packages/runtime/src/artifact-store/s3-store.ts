import { parseJsonl } from './json.js';
import { DEFAULT_ARTIFACT_ROOT, normalizeS3Prefix, s3GroupPrefix, s3Key } from './paths.js';
import { isS3ArtifactClient } from './s3-client.js';
import type { ArtifactRef, ArtifactStore, S3ArtifactClient, S3ArtifactStoreOptions } from './types.js';

export function createS3ArtifactStore(options: S3ArtifactStoreOptions): ArtifactStore {
  const prefix = normalizeS3Prefix(options.prefix ?? DEFAULT_ARTIFACT_ROOT);
  const rootUri = `s3://${options.bucket}${prefix ? `/${prefix}` : ''}`;

  if (!options.bucket) {
    throw new Error('S3 artifact store requires a bucket');
  }

  return {
    kind: 's3',
    rootUri,
    uri(ref: ArtifactRef) {
      return `s3://${options.bucket}/${s3Key(prefix, ref)}`;
    },
    async writeJson(ref, value) {
      return writeS3Text(options, prefix, ref, `${JSON.stringify(value, null, 2)}\n`, 'application/json');
    },
    async readJson<T>(ref: ArtifactRef) {
      return readS3Json<T>(options, prefix, ref);
    },
    async listJson<T>(group: string) {
      const keys = await listS3Keys(options, prefix, group);
      const values: T[] = [];

      for (const key of keys.filter((entry) => entry.endsWith('.json')).sort()) {
        const fileName = key.slice(s3GroupPrefix(prefix, group).length);
        const value = await readS3Json<T>(options, prefix, { group, fileName });
        if (value) {
          values.push(value);
        }
      }

      return values;
    },
    async writeText(ref, contents) {
      return writeS3Text(options, prefix, ref, contents, 'text/plain; charset=utf-8');
    },
    async readText(ref) {
      return readS3Text(options, prefix, ref);
    },
    async appendJsonl(ref, value) {
      const previous = await readS3Text(options, prefix, ref);
      return writeS3Text(
        options,
        prefix,
        ref,
        `${previous ?? ''}${JSON.stringify(value)}\n`,
        'application/x-ndjson',
      );
    },
    async readJsonl<T>(ref: ArtifactRef) {
      return parseJsonl<T>(await readS3Text(options, prefix, ref));
    },
  };
}

export function asS3ArtifactClient(value: unknown): S3ArtifactClient {
  if (!isS3ArtifactClient(value)) {
    throw new Error('S3 artifact store requires a client with putObject, getObject, and listObjectsV2 methods');
  }

  return value;
}

async function readS3Json<T>(
  options: S3ArtifactStoreOptions,
  prefix: string,
  ref: ArtifactRef,
): Promise<T | null> {
  const contents = await readS3Text(options, prefix, ref);
  if (!contents) {
    return null;
  }

  try {
    return JSON.parse(contents) as T;
  } catch {
    return null;
  }
}

async function writeS3Text(
  options: S3ArtifactStoreOptions,
  prefix: string,
  ref: ArtifactRef,
  contents: string,
  contentType: string,
): Promise<string> {
  const key = s3Key(prefix, ref);

  await options.client.putObject({
    Bucket: options.bucket,
    Key: key,
    Body: contents,
    ContentType: contentType,
  });

  return `s3://${options.bucket}/${key}`;
}

async function readS3Text(
  options: S3ArtifactStoreOptions,
  prefix: string,
  ref: ArtifactRef,
): Promise<string | null> {
  try {
    const output = await options.client.getObject({
      Bucket: options.bucket,
      Key: s3Key(prefix, ref),
    });

    return bodyToString(output.Body);
  } catch (err) {
    if (isMissingS3Object(err)) {
      return null;
    }

    throw err;
  }
}

async function listS3Keys(
  options: S3ArtifactStoreOptions,
  prefix: string,
  group: string,
): Promise<string[]> {
  const groupPrefix = s3GroupPrefix(prefix, group);
  const keys: string[] = [];
  let token: string | undefined;

  do {
    const output = await options.client.listObjectsV2({
      Bucket: options.bucket,
      Prefix: groupPrefix,
      ContinuationToken: token,
    });

    for (const item of output.Contents ?? []) {
      if (item.Key) {
        keys.push(item.Key);
      }
    }

    token = output.IsTruncated ? output.NextContinuationToken : undefined;
  } while (token);

  return keys;
}

async function bodyToString(body: unknown): Promise<string | null> {
  if (body === undefined || body === null) {
    return null;
  }

  if (typeof body === 'string') {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString('utf8');
  }

  if (body instanceof ArrayBuffer) {
    return Buffer.from(body).toString('utf8');
  }

  if (hasTransformToString(body)) {
    return body.transformToString();
  }

  if (isAsyncIterable<Uint8Array | string>(body)) {
    const chunks = [];

    for await (const chunk of body) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf8');
  }

  return String(body);
}

function hasTransformToString(value: unknown): value is { transformToString(): Promise<string> } {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as { transformToString?: unknown }).transformToString === 'function';
}

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function';
}

function isMissingS3Object(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }

  const record = err as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
    statusCode?: number;
  };

  return record.name === 'NoSuchKey'
    || record.Code === 'NoSuchKey'
    || record.code === 'NoSuchKey'
    || record.$metadata?.httpStatusCode === 404
    || record.statusCode === 404;
}
