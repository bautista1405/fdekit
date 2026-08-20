import type {
  EffectivePolicy,
  ProjectSkillExecutionMode,
  ProjectSkillGrant,
  ProjectSkillManifest,
  ProjectSkillManifestIssue,
  ProjectSkillManifestValidation,
} from '../types/index.js';
import { isSafeRepositoryPath } from '../repositories/index.js';

export function validateProjectSkillManifest(value: unknown): ProjectSkillManifestValidation {
  const issues: ProjectSkillManifestIssue[] = [];
  if (!value || typeof value !== 'object') return { valid: false, issues: [{ path: '', message: 'Manifest must be an object.' }] };
  const manifest = value as Partial<ProjectSkillManifest>;
  if (manifest.schemaVersion !== 1) issues.push({ path: 'schemaVersion', message: 'Only schema version 1 is supported.' });
  for (const key of ['name', 'version', 'description', 'license', 'entrypoint'] as const) {
    if (typeof manifest[key] !== 'string' || !manifest[key]?.trim()) issues.push({ path: key, message: `${key} is required.` });
  }
  if (typeof manifest.entrypoint === 'string' && !isSafeRepositoryPath(manifest.entrypoint)) {
    issues.push({ path: 'entrypoint', message: 'Entrypoint must be a project-relative safe path.' });
  }
  if (!Array.isArray(manifest.executionModes) || manifest.executionModes.length === 0) {
    issues.push({ path: 'executionModes', message: 'At least one execution mode is required.' });
  } else if (manifest.executionModes.some((mode) => !['diff_only', 'shadow', 'apply'].includes(mode))) {
    issues.push({ path: 'executionModes', message: 'Execution modes must be diff_only, shadow, or apply.' });
  }
  if (!Array.isArray(manifest.requestedCapabilities)) issues.push({ path: 'requestedCapabilities', message: 'requestedCapabilities must be an array.' });
  if (!Array.isArray(manifest.evalRefs) || manifest.evalRefs.length === 0) issues.push({ path: 'evalRefs', message: 'At least one eval reference is required.' });
  if (!manifest.provenance || typeof manifest.provenance.source !== 'string' || typeof manifest.provenance.digest !== 'string') {
    issues.push({ path: 'provenance', message: 'Provenance source and digest are required.' });
  }
  return { valid: issues.length === 0, issues };
}

export function evaluateProjectSkillGrant(
  manifest: ProjectSkillManifest,
  mode: ProjectSkillExecutionMode,
  policy: EffectivePolicy,
): ProjectSkillGrant {
  const reasons: string[] = [];
  const modeDeclared = manifest.executionModes.includes(mode);
  const grantedCapabilities = manifest.requestedCapabilities.filter((capability) => policy.capabilities.includes(capability));
  const deniedCapabilities = manifest.requestedCapabilities.filter((capability) => !policy.capabilities.includes(capability));
  const requestedSources = manifest.requestedSourceIds ?? [];
  const grantedSourceIds = requestedSources.filter((sourceId) => !policy.sourceAllowlist || policy.sourceAllowlist.includes(sourceId));
  const deniedSources = requestedSources.filter((sourceId) => !grantedSourceIds.includes(sourceId));

  if (!modeDeclared) reasons.push(`Skill does not declare ${mode} mode.`);
  if (policy.decision === 'deny') reasons.push('Effective policy denied execution.');
  if (deniedCapabilities.length > 0) reasons.push(`Capabilities not granted: ${deniedCapabilities.join(', ')}.`);
  if (deniedSources.length > 0) reasons.push(`Sources not granted: ${deniedSources.join(', ')}.`);
  const approvalCapabilities = grantedCapabilities.filter((capability) => policy.approvalRequiredFor.includes(capability));
  if (approvalCapabilities.length > 0) reasons.push(`Approval required for: ${approvalCapabilities.join(', ')}.`);
  if (mode === 'apply' && !grantedCapabilities.includes('external:write')) reasons.push('Apply mode requires external:write.');

  const hardDenied = !modeDeclared
    || policy.decision === 'deny'
    || deniedCapabilities.length > 0
    || deniedSources.length > 0
    || (mode === 'apply' && !grantedCapabilities.includes('external:write'));
  const decision = hardDenied
    ? 'deny'
    : approvalCapabilities.length > 0 || policy.decision === 'needs_approval'
      ? 'needs_approval'
      : 'allow';

  return {
    skill: manifest.name,
    version: manifest.version,
    mode,
    decision,
    grantedCapabilities,
    grantedSourceIds,
    reasons,
    policyFingerprint: policy.fingerprint,
  };
}
