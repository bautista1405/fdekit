import { mkdir, mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { codebaseConnector } from '../index.js';

describe('codebaseConnector', () => {
  it('declares allowed environments on every tool', () => {
    const connector = codebaseConnector();

    for (const tool of connector.tools ?? []) {
      expect(tool.environments).toEqual(['local', 'development', 'staging']);
    }
  });

  it('documents codebase.search as literal substring matching', () => {
    const connector = codebaseConnector();
    const search = connector.tools?.find((tool) => tool.name === 'codebase.search');
    const argsSchema = search?.argsSchema as {
      properties?: {
        query?: {
          description?: string;
        };
      };
    };

    expect(search?.description).toContain('literal substring');
    expect(argsSchema.properties?.query?.description).toContain('not a regex');
  });

  it('resolves relative roots from the loaded FDEKit project directory', () => {
    const contained = codebaseConnector({
      env: {
        FDEKIT_PROJECT_DIR: '/customer/app/fdekit',
      },
    });
    const recipe = codebaseConnector({
      rootDir: './sample-repo',
      env: {
        FDEKIT_PROJECT_DIR: '/customer/app/fdekit',
      },
    });

    expect(contained.config.rootDir).toBe(path.resolve('/customer/app'));
    expect(recipe.config.rootDir).toBe(path.resolve('/customer/app/fdekit/sample-repo'));
  });

  it('lists, searches, and reads files within the configured root', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-codebase-'));
    await mkdir(path.join(rootDir, 'src'), { recursive: true });
    await writeFile(path.join(rootDir, 'src', 'billing.ts'), [
      'export function syncBilling() {',
      '  // TODO(fdekit): add retry handling before production rollout',
      '  return true;',
      '}',
    ].join('\n'), 'utf8');
    await writeFile(path.join(rootDir, 'README.md'), '# Demo\n', 'utf8');

    const connector = codebaseConnector({ rootDir });
    const listFiles = connector.tools?.find((tool) => tool.name === 'codebase.listFiles');
    const search = connector.tools?.find((tool) => tool.name === 'codebase.search');
    const read = connector.tools?.find((tool) => tool.name === 'codebase.readFile');

    await expect(listFiles?.handler({ pattern: 'src' }, {})).resolves.toMatchObject({
      files: [{ filePath: 'src/billing.ts' }],
    });
    await expect(search?.handler({ query: 'TODO(fdekit)' }, {})).resolves.toMatchObject({
      query: 'TODO(fdekit)',
      matches: [
        {
          filePath: 'src/billing.ts',
          line: 2,
          preview: '// TODO(fdekit): add retry handling before production rollout',
        },
      ],
    });
    await expect(read?.handler({ filePath: 'src/billing.ts', startLine: 2, endLine: 2 }, {})).resolves.toMatchObject({
      filePath: 'src/billing.ts',
      content: '  // TODO(fdekit): add retry handling before production rollout',
      startLine: 2,
      endLine: 2,
      truncated: false,
    });
  });

  it('blocks file reads that escape the codebase root', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'fdekit-codebase-'));
    const connector = codebaseConnector({ rootDir });
    const read = connector.tools?.find((tool) => tool.name === 'codebase.readFile');

    await expect(read?.handler({ filePath: '../secret.txt' }, {})).rejects.toThrow('escapes root');
  });
});
