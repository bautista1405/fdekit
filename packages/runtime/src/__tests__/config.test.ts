import { mkdtemp, writeFile } from 'fs/promises';
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
});
