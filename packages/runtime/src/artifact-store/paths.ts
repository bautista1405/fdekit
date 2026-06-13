import * as path from 'path';
import type { ArtifactRef } from './types.js';

export const DEFAULT_ARTIFACT_ROOT = '.fdekit';

export function localPath(root: string, ref: ArtifactRef): string {
  return path.join(localGroupPath(root, ref.group), ref.fileName);
}

export function localGroupPath(root: string, group: string): string {
  return path.join(root, ...normalizeParts(group));
}

export function s3Key(prefix: string, ref: ArtifactRef): string {
  return path.posix.join(prefix, ...normalizeParts(ref.group), ...normalizeParts(ref.fileName));
}

export function s3GroupPrefix(prefix: string, group: string): string {
  return `${path.posix.join(prefix, ...normalizeParts(group))}/`;
}

export function normalizeS3Prefix(value: string): string {
  return normalizeParts(value).join('/');
}

export function normalizeParts(value: string): string[] {
  return value
    .split(/[\\/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
