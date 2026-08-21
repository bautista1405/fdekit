import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

  /**
   * The helpers above hand scaffolded projects the catalog's own version, which is
   * only a safe stand-in for "the version every @fdekit package publishes at" while
   * every published package shares one version. Changesets guarantees that through
   * the `fixed` group, so membership of that group is the real invariant.
   *
   * The catalog was once added as a new package without being added to the group.
   * It took an independent minor bump to 0.6.0 while the runtime packages stayed on
   * 0.5.6, scaffolds began pinning a version that was never published, and
   * `npm install` failed with ETARGET in every new project.
   */
  it('keeps every published package inside one changesets fixed group', () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
    const changesetConfig = JSON.parse(
      readFileSync(join(repoRoot, '.changeset', 'config.json'), 'utf8'),
    ) as { fixed?: string[][]; ignore?: string[] };

    const grouped = new Set((changesetConfig.fixed ?? []).flat());
    const ignored = new Set(changesetConfig.ignore ?? []);

    const workspaceDirs = ['packages', 'packages/providers', 'packages/connectors', 'packages/environments'];
    const published: string[] = [];

    for (const workspaceDir of workspaceDirs) {
      const absoluteDir = join(repoRoot, workspaceDir);

      for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }

        const manifestPath = join(absoluteDir, entry.name, 'package.json');

        if (!existsSync(manifestPath)) {
          continue;
        }

        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
          name: string;
          private?: boolean;
        };

        if (manifest.private === true || ignored.has(manifest.name)) {
          continue;
        }

        published.push(manifest.name);
      }
    }

    expect(published.length).toBeGreaterThan(0);

    const ungrouped = published.filter((name) => !grouped.has(name)).sort();

    expect(ungrouped).toEqual([]);
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
