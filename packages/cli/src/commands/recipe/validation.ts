import type { CapturedRecipeManifest } from './types.js';

export function stripEmptyManifestFields(manifest: CapturedRecipeManifest): CapturedRecipeManifest {
  return JSON.parse(JSON.stringify(manifest)) as CapturedRecipeManifest;
}

export function isDefaultScaffoldConfig(config: string): boolean {
  const hasStarterProvider = config.includes("provider: 'openai'")
    || (config.includes('const providerFactories = {')
      && (config.includes('settings.provider') || config.includes('settings.modelProvider')));

  return config.includes('support-triage-agent-smoke')
    && config.includes('deployment-smoke')
    && hasStarterProvider;
}

export function isValidRecipeName(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value);
}
