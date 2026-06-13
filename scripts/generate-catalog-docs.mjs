import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogDocsPath = path.join(rootDir, 'packages', 'cli', 'dist', 'catalog', 'docs.js');

const {
  renderCliReferenceCatalogTable,
  renderConnectorPackageTable,
  renderConnectorSupportTable,
  renderProviderPackageTable,
  renderProviderSupportTable,
  renderRecipeTable,
} = await import(pathToFileURL(catalogDocsPath).href);

await replaceBlocks(path.join(rootDir, 'docs', 'support-matrix.md'), {
  'provider-support': renderProviderSupportTable(),
  'connector-support': renderConnectorSupportTable(),
  'provider-packages': renderProviderPackageTable(),
  'connector-packages': renderConnectorPackageTable(),
});

await replaceBlocks(path.join(rootDir, 'docs', 'cli-reference.md'), {
  'cli-catalog': renderCliReferenceCatalogTable(),
});

await replaceBlocks(path.join(rootDir, 'README.md'), {
  'recipe-table': renderRecipeTable(),
});

async function replaceBlocks(filePath, replacements) {
  let contents = await fs.readFile(filePath, 'utf8');

  for (const [blockName, replacement] of Object.entries(replacements)) {
    contents = replaceBlock(contents, blockName, replacement);
  }

  await fs.writeFile(filePath, contents, 'utf8');
}

function replaceBlock(contents, blockName, replacement) {
  const start = `<!-- fdekit-catalog:${blockName}:start -->`;
  const end = `<!-- fdekit-catalog:${blockName}:end -->`;
  const startIndex = contents.indexOf(start);
  const endIndex = contents.indexOf(end);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Missing docs block ${blockName}.`);
  }

  return [
    contents.slice(0, startIndex + start.length),
    '\n',
    replacement.trimEnd(),
    '\n',
    contents.slice(endIndex),
  ].join('');
}
