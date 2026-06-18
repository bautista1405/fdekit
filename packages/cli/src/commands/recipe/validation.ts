import type { CapturedRecipeManifest } from './types.js';
import { isDefaultStarterConfig } from '../../scaffolds/starter.js';

export function stripEmptyManifestFields(manifest: CapturedRecipeManifest): CapturedRecipeManifest {
  return JSON.parse(JSON.stringify(manifest)) as CapturedRecipeManifest;
}

export function isDefaultScaffoldConfig(config: string): boolean {
  return isDefaultStarterConfig(config);
}

export function isValidRecipeName(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value);
}
