import { createRequire } from 'module';

const require = createRequire(import.meta.url);

interface PackageJson {
  version?: string;
}

const packageJson = require('../package.json') as PackageJson;

export const fdekitCliVersion = packageJson.version ?? '0.0.0';

export const fdekitDependencyVersion =
  process.env.FDEKIT_SCAFFOLD_VERSION ?? fdekitCliVersion;

export const fdekitCaretDependencyVersion = `^${fdekitDependencyVersion}`;

export function fdekitDependency(packageName: string): Record<string, string> {
  return {
    [packageName]: fdekitDependencyVersion,
  };
}

export function fdekitDependencies(packageNames: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    packageNames.map((packageName) => [packageName, fdekitDependencyVersion]),
  );
}
