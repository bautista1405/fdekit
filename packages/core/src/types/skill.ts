import type { EffectivePolicy, PolicyCapability, SourceSnapshot } from './execution.js';

export type ProjectSkillExecutionMode = 'diff_only' | 'shadow' | 'apply';

export interface ProjectSkillManifest {
  schemaVersion: 1;
  name: string;
  version: string;
  description: string;
  license: string;
  entrypoint: string;
  executionModes: ProjectSkillExecutionMode[];
  requestedCapabilities: PolicyCapability[];
  requestedSourceIds?: string[];
  tools?: string[];
  evalRefs: string[];
  provenance: {
    source: string;
    digest: string;
    reviewedAt?: string;
    sourceSnapshots?: SourceSnapshot[];
  };
  metadata?: Record<string, unknown>;
}

export interface ProjectSkillManifestIssue {
  path: string;
  message: string;
}

export interface ProjectSkillManifestValidation {
  valid: boolean;
  issues: ProjectSkillManifestIssue[];
}

export interface ProjectSkillGrant {
  skill: string;
  version: string;
  mode: ProjectSkillExecutionMode;
  decision: 'allow' | 'deny' | 'needs_approval';
  grantedCapabilities: PolicyCapability[];
  grantedSourceIds: string[];
  reasons: string[];
  policyFingerprint: EffectivePolicy['fingerprint'];
}
