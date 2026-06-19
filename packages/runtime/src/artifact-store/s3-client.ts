import type { S3ArtifactClient } from './types.js';

export function isS3ArtifactClient(value: unknown): value is S3ArtifactClient {
  const candidate = value as Partial<S3ArtifactClient> | undefined;

  return Boolean(
    candidate
    && typeof candidate.putObject === 'function'
    && typeof candidate.getObject === 'function'
    && typeof candidate.listObjectsV2 === 'function',
  );
}
