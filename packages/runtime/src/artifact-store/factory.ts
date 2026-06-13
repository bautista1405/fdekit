import type { ArtifactStoreDefinition } from '@fdekit/core';
import { createFileArtifactStore } from './local-store.js';
import { asS3ArtifactClient, createS3ArtifactStore } from './s3-store.js';
import type { ArtifactStore, CreateArtifactStoreOptions } from './types.js';

export function createArtifactStore(options: CreateArtifactStoreOptions): ArtifactStore {
  if (options.store) {
    return options.store;
  }

  return createArtifactStoreFromDefinition(options.deployment?.artifacts, options.projectDir);
}

export function createArtifactStoreFromDefinition(
  definition: ArtifactStoreDefinition | undefined,
  projectDir: string,
): ArtifactStore {
  if (!definition || definition.kind === undefined || definition.kind === 'local') {
    return createFileArtifactStore({
      projectDir,
      rootDir: definition?.rootDir,
    });
  }

  if (definition.kind === 's3') {
    return createS3ArtifactStore({
      bucket: definition.bucket,
      prefix: definition.prefix,
      region: definition.region,
      client: asS3ArtifactClient(definition.client),
    });
  }

  throw new Error(`Unsupported artifact store: ${(definition as { kind?: string }).kind ?? 'unknown'}`);
}
