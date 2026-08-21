import { createRequire } from 'module';

const require = createRequire(import.meta.url);

interface PackageJson {
  version?: string;
}

const packageJson = require('../package.json') as PackageJson;

/**
 * The version manifests pin scaffolded projects to.
 *
 * Reads this package's own version rather than the CLI's. Every `@fdekit/*`
 * package is released together by changesets, so the two are always equal - and
 * reading locally is what lets the catalog stand alone instead of reaching back
 * into the CLI.
 *
 * `FDEKIT_SCAFFOLD_VERSION` overrides it, which is how the example-sync and
 * recipe tests scaffold against a fixed version.
 */
export const fdekitCatalogVersion = packageJson.version ?? '0.0.0';

export const fdekitDependencyVersion = process.env.FDEKIT_SCAFFOLD_VERSION ?? fdekitCatalogVersion;

export const fdekitCaretDependencyVersion = `^${fdekitDependencyVersion}`;

export function fdekitDependency(packageName: string): Record<string, string> {
  return {
    [packageName]: fdekitDependencyVersion,
  };
}

export function fdekitDependencies(packageNames: readonly string[]): Record<string, string> {
  return Object.fromEntries(packageNames.map((packageName) => [packageName, fdekitDependencyVersion]));
}
