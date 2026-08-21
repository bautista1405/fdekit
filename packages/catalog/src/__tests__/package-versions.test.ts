import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json') as { version: string };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('catalog package versions', () => {
  it('uses the catalog package version for generated dependencies by default', async () => {
    vi.stubEnv('FDEKIT_SCAFFOLD_VERSION', undefined);
    const versions = await import('../package-versions.js');

    expect(versions.fdekitCatalogVersion).toBe(packageJson.version);
    expect(versions.fdekitDependencyVersion).toBe(packageJson.version);
    expect(versions.fdekitCaretDependencyVersion).toBe(`^${packageJson.version}`);
    expect(versions.fdekitDependency('@fdekit/core')).toEqual({
      '@fdekit/core': packageJson.version,
    });
    expect(versions.fdekitDependencies(['@fdekit/core', '@fdekit/runtime'])).toEqual({
      '@fdekit/core': packageJson.version,
      '@fdekit/runtime': packageJson.version,
    });
  });

  it('honors the scaffold-version override consistently', async () => {
    vi.stubEnv('FDEKIT_SCAFFOLD_VERSION', '9.8.7-next.1');
    vi.resetModules();
    const versions = await import('../package-versions.js');

    expect(versions.fdekitDependencyVersion).toBe('9.8.7-next.1');
    expect(versions.fdekitCaretDependencyVersion).toBe('^9.8.7-next.1');
    expect(versions.fdekitDependencies(['@fdekit/core', '@fdekit/runtime'])).toEqual({
      '@fdekit/core': '9.8.7-next.1',
      '@fdekit/runtime': '9.8.7-next.1',
    });
  });
});
