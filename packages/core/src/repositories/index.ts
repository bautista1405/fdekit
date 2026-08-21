import type {
  RepositoryChangeSet,
  RepositoryChangeSetValidation,
  RepositoryValidationIssue,
} from '../types/index.js';

export interface ValidateRepositoryChangeSetOptions {
  maxChanges?: number;
  maxContentBytes?: number;
}

export function validateRepositoryChangeSet(
  changeSet: RepositoryChangeSet,
  options: ValidateRepositoryChangeSetOptions = {},
): RepositoryChangeSetValidation {
  const issues: RepositoryValidationIssue[] = [];
  const maxChanges = options.maxChanges ?? 100;
  const maxContentBytes = options.maxContentBytes ?? 1_000_000;

  if (changeSet.schemaVersion !== 1) issues.push({ code: 'schema_version', message: 'Unsupported change-set schema version.' });
  if (!changeSet.changeSetId.trim()) issues.push({ code: 'change_set_id', message: 'changeSetId is required.' });
  if (!changeSet.repositoryId.trim()) issues.push({ code: 'repository_id', message: 'repositoryId is required.' });
  if (!changeSet.base.sourceId || !changeSet.base.revision || !changeSet.base.ref) {
    issues.push({ code: 'base_identity', message: 'An immutable source, revision, and ref are required.' });
  }
  if (changeSet.changes.length === 0) issues.push({ code: 'empty', message: 'A change set must contain at least one change.' });
  if (changeSet.changes.length > maxChanges) issues.push({ code: 'change_limit', message: `A change set may contain at most ${maxChanges} changes.` });
  const seen = new Set<string>();

  for (const change of changeSet.changes) {
    if (!isSafeRepositoryPath(change.path)) {
      issues.push({ code: 'unsafe_path', path: change.path, message: 'Path must be normalized and repository-relative.' });
      continue;
    }
    if (seen.has(change.path)) issues.push({ code: 'duplicate_path', path: change.path, message: 'A path may change only once per transaction.' });
    seen.add(change.path);
    if (!isPermittedRepositoryPath(change.path, changeSet.permittedPaths)) {
      issues.push({ code: 'path_not_permitted', path: change.path, message: 'Path is outside the declared permitted paths.' });
    }
    if (change.operation === 'create') {
      if (change.content === undefined) issues.push({ code: 'content_required', path: change.path, message: 'Create requires content.' });
      if (change.expectedBlobOid) issues.push({ code: 'unexpected_blob', path: change.path, message: 'Create must not declare expectedBlobOid.' });
    } else if (change.operation === 'update') {
      if (change.content === undefined) issues.push({ code: 'content_required', path: change.path, message: 'Update requires content.' });
      if (!change.expectedBlobOid) issues.push({ code: 'expected_blob_required', path: change.path, message: 'Update requires expectedBlobOid.' });
    } else {
      if (change.content !== undefined) issues.push({ code: 'delete_content', path: change.path, message: 'Delete must not include content.' });
      if (!change.expectedBlobOid) issues.push({ code: 'expected_blob_required', path: change.path, message: 'Delete requires expectedBlobOid.' });
    }
    if (change.content !== undefined && new TextEncoder().encode(change.content).byteLength > maxContentBytes) {
      issues.push({ code: 'content_limit', path: change.path, message: `Content exceeds ${maxContentBytes} bytes.` });
    }
  }

  return { valid: issues.length === 0, issues, evidence: [] };
}

export function isSafeRepositoryPath(value: string): boolean {
  return Boolean(value)
    && !value.startsWith('/')
    && !value.startsWith('\\')
    && !value.includes('\\')
    && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

export function isPermittedRepositoryPath(path: string, permittedPaths: string[]): boolean {
  return permittedPaths.some((prefix) => {
    const normalized = prefix.replace(/\/$/, '');
    return isSafeRepositoryPath(normalized) && (path === normalized || path.startsWith(`${normalized}/`));
  });
}
