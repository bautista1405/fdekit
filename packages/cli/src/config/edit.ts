import { ensurePackageImports as ensurePackageImportsInternal } from './editing/imports.js';

export { insertArrayItem, insertObjectEntry } from './editing/deployment.js';
export { hasObjectEntry } from './editing/deployment.js';
export { ensurePackageImports } from './editing/imports.js';

export function ensureCoreImports(config: string, imports: string[]): string {
  return ensurePackageImportsInternal(config, '@fdekit/core', imports);
}
