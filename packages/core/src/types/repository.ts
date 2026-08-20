import type { ActorIdentity, PlannedAction, SourceSnapshot } from './execution.js';

export interface RepositoryProviderCapabilities {
  immutableReads: boolean;
  multiFileTransactions: boolean;
  atomicExpectedRefUpdate: boolean;
  protectedChangeRequest: boolean;
}

export interface RepositoryFileChange {
  operation: 'create' | 'update' | 'delete';
  path: string;
  content?: string;
  expectedBlobOid?: string;
  mode?: '100644' | '100755';
}

export interface RepositoryChangeSet {
  schemaVersion: 1;
  changeSetId: string;
  repositoryId: string;
  base: SourceSnapshot & { ref: string };
  changes: RepositoryFileChange[];
  permittedPaths: string[];
  createdAt: string;
  plannedAction?: PlannedAction;
  metadata?: Record<string, unknown>;
}

export interface RepositoryValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export interface RepositoryValidationEvidence {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  message?: string;
  artifactId?: string;
}

export interface RepositoryChangeSetValidation {
  valid: boolean;
  issues: RepositoryValidationIssue[];
  evidence: RepositoryValidationEvidence[];
}

export interface RepositoryPublicationRequest {
  ref: string;
  expectedOldOid: string;
  message: string;
  actor: ActorIdentity;
  mode?: 'atomic_ref' | 'protected_change_request';
}

export interface RepositoryTransactionResult {
  status:
    | 'validated'
    | 'committed'
    | 'stale'
    | 'validation_failed'
    | 'protected_fallback_required';
  changeSetId: string;
  baseOid: string;
  treeOid?: string;
  commitOid?: string;
  ref?: string;
  validation: RepositoryChangeSetValidation;
  message?: string;
}

export interface RepositoryTransactionOptions {
  shadow?: boolean;
  publication?: RepositoryPublicationRequest;
}

export interface RepositoryOperations {
  capabilities(): RepositoryProviderCapabilities;
  resolveRef(ref: string): Promise<string>;
  readFile(objectId: string, path: string): Promise<{ content: string; blobOid: string } | null>;
  applyChangeSet(
    changeSet: RepositoryChangeSet,
    options?: RepositoryTransactionOptions,
  ): Promise<RepositoryTransactionResult>;
}
