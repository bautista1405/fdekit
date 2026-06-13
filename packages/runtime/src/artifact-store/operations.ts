import { createFileArtifactStore } from './local-store.js';
import type { ArtifactStore } from './types.js';

export async function writeJsonArtifact(
  projectDir: string,
  group: string,
  fileName: string,
  value: unknown,
  artifactStore?: ArtifactStore,
): Promise<string> {
  return storeFor(projectDir, artifactStore).writeJson({ group, fileName }, value);
}

export async function writeTextArtifact(
  projectDir: string,
  group: string,
  fileName: string,
  contents: string,
  artifactStore?: ArtifactStore,
): Promise<string> {
  return storeFor(projectDir, artifactStore).writeText({ group, fileName }, contents);
}

export async function readJsonArtifact<T = unknown>(
  projectDir: string,
  group: string,
  fileName: string,
  artifactStore?: ArtifactStore,
): Promise<T | null> {
  return storeFor(projectDir, artifactStore).readJson<T>({ group, fileName });
}

export async function readJsonArtifacts<T = unknown>(
  projectDir: string,
  group: string,
  artifactStore?: ArtifactStore,
): Promise<T[]> {
  return storeFor(projectDir, artifactStore).listJson<T>(group);
}

export async function readTextArtifact(
  projectDir: string,
  group: string,
  fileName: string,
  artifactStore?: ArtifactStore,
): Promise<string | null> {
  return storeFor(projectDir, artifactStore).readText({ group, fileName });
}

export async function appendJsonlArtifact(
  projectDir: string,
  group: string,
  fileName: string,
  value: unknown,
  artifactStore?: ArtifactStore,
): Promise<string> {
  return storeFor(projectDir, artifactStore).appendJsonl({ group, fileName }, value);
}

export async function readJsonlArtifact<T = unknown>(
  projectDir: string,
  group: string,
  fileName: string,
  artifactStore?: ArtifactStore,
): Promise<T[]> {
  return storeFor(projectDir, artifactStore).readJsonl<T>({ group, fileName });
}

function storeFor(projectDir: string, artifactStore: ArtifactStore | undefined): ArtifactStore {
  return artifactStore ?? createFileArtifactStore({ projectDir });
}
