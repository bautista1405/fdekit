import { createRequire } from 'module';

const require = createRequire(import.meta.url);

interface PackageJson {
  version?: string;
}

const packageJson = require('../package.json') as PackageJson;

/** The CLI's own version, reported by `fdekit --version`. */
export const fdekitCliVersion = packageJson.version ?? '0.0.0';

/**
 * Scaffold dependency pinning lives in `@fdekit/catalog` alongside the manifests
 * that use it, and is re-exported here so existing call sites keep one import.
 */
export {
  fdekitCaretDependencyVersion,
  fdekitDependencies,
  fdekitDependency,
  fdekitDependencyVersion,
} from '@fdekit/catalog';
