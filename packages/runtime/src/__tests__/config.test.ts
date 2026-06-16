import { mkdir, mkdtemp, readdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { loadDeployment } from '../config/index.js';

describe('loadDeployment', () => {
  it('loads project .env values before evaluating fde.config.ts', async () => {
    const projectDir = await mkdtemp(path.join(tmpdir(), 'fdekit-config-env-'));
    const previous = process.env.FDEKIT_PROVIDER;
    delete process.env.FDEKIT_PROVIDER;

    try {
      await writeFile(path.join(projectDir, '.env'), 'FDEKIT_PROVIDER=localOllama\n', 'utf8');
      await writeFile(path.join(projectDir, 'fde.config.ts'), `
import { defineDeployment } from '@fdekit/core';

export default defineDeployment({
  name: 'env-config-test',
  providers: {
    selected: { name: process.env.FDEKIT_PROVIDER ?? 'mock' },
  },
  agents: {},
});
`, 'utf8');

      const deployment = await loadDeployment(path.join(projectDir, 'fde.config.ts'));

      expect(deployment.providers.selected.name).toBe('localOllama');
    } finally {
      if (previous === undefined) {
        delete process.env.FDEKIT_PROVIDER;
      } else {
        process.env.FDEKIT_PROVIDER = previous;
      }
    }
  }, 10000);

  it('uses one content-addressed config cache file across repeated loads', async () => {
    const projectDir = await mkdtemp(path.join(tmpdir(), 'fdekit-config-cache-'));
    const cacheDir = path.join(projectDir, '.fdekit', 'cache');
    const configPath = path.join(projectDir, 'fde.config.ts');

    await mkdir(cacheDir, { recursive: true });
    await writeFile(path.join(cacheDir, 'fde.config123456789.mjs'), 'export default {};\n', 'utf8');
    await writeFile(configPath, `
import { defineDeployment } from '@fdekit/core';

export default defineDeployment({
  name: 'cache-config-test',
  providers: {},
  agents: {},
});
`, 'utf8');

    await loadDeployment(configPath);
    await loadDeployment(configPath);
    await loadDeployment(configPath);

    const cacheFiles = (await readdir(cacheDir))
      .filter((fileName) => fileName.startsWith('fde.config'))
      .sort();

    expect(cacheFiles).toHaveLength(1);
    expect(cacheFiles[0]).toMatch(/^fde\.config\.ts-[a-f0-9]{12}\.mjs$/);
  }, 10000);

  it('reevaluates content-cached configs in the same process', async () => {
    const projectDir = await mkdtemp(path.join(tmpdir(), 'fdekit-config-cache-env-'));
    const configPath = path.join(projectDir, 'fde.config.ts');
    const previous = process.env.FDEKIT_CONFIG_CACHE_TEST_NAME;

    try {
      await writeFile(configPath, `
import { defineDeployment } from '@fdekit/core';

export default defineDeployment({
  name: process.env.FDEKIT_CONFIG_CACHE_TEST_NAME ?? 'missing',
  providers: {},
  agents: {},
});
`, 'utf8');

      process.env.FDEKIT_CONFIG_CACHE_TEST_NAME = 'first-load';
      const first = await loadDeployment(configPath);

      process.env.FDEKIT_CONFIG_CACHE_TEST_NAME = 'second-load';
      const second = await loadDeployment(configPath);

      expect(first.name).toBe('first-load');
      expect(second.name).toBe('second-load');
    } finally {
      if (previous === undefined) {
        delete process.env.FDEKIT_CONFIG_CACHE_TEST_NAME;
      } else {
        process.env.FDEKIT_CONFIG_CACHE_TEST_NAME = previous;
      }
    }
  }, 10000);
});
