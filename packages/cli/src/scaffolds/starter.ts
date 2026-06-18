export function isDefaultStarterConfig(config: string): boolean {
  return isCurrentStarterConfig(config) || isLegacyStarterConfig(config);
}

function isCurrentStarterConfig(config: string): boolean {
  return config.includes('const provider = providerFromEnv();')
    && config.includes("name: 'support-triage-smoke'")
    && config.includes("instructions: './agents/support-triage.md'");
}

function isLegacyStarterConfig(config: string): boolean {
  const hasStarterProvider = config.includes("provider: 'openai'")
    || (config.includes('const providerFactories = {')
      && (config.includes('settings.provider') || config.includes('settings.modelProvider')));

  return config.includes('support-triage-agent-smoke')
    && config.includes('deployment-smoke')
    && hasStarterProvider;
}
