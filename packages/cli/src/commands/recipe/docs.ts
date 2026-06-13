import { asRecord, type DeploymentDefinition } from '@fdekit/core';
import type { CapturedRecipeManifest } from './types.js';

export function renderWorkflowDoc(deployment: DeploymentDefinition): string {
  const workflow = deployment.workflow;
  const metrics = deployment.outcomeMetrics ?? [];

  return `# ${workflow?.name ?? deployment.name}

## Owner

${workflow?.owner ?? 'not assigned'}

## Current Workflow

${workflow?.currentState?.summary ?? 'No current workflow summary captured yet'}

## Target Workflow

${workflow?.targetState?.summary ?? 'No target workflow summary captured yet'}

Target: ${workflow?.targetState?.target ?? 'not configured'}

## Outcome Metrics

${metrics.length > 0
  ? metrics.map((metric) => `- ${metric.name ?? 'metric'}: ${metric.baseline ?? 'baseline not configured'} -> ${metric.target ?? 'target not configured'}`).join('\n')
  : '- No outcome metrics configured yet'}

## Rollout

- Current stage: ${deployment.rollout?.stage ?? 'not configured'}
- Next step: ${deployment.rollout?.next ?? 'not configured'}
`;
}

export function renderCapturedRecipeReadme(manifest: CapturedRecipeManifest): string {
  return `# ${manifest.name}

Captured from deployment \`${manifest.sourceDeployment}\` on ${manifest.capturedAt}.

## Install

\`\`\`bash
fdekit recipe install recipes/${manifest.name}
\`\`\`

From another project, pass the path to this directory:

\`\`\`bash
fdekit recipe install /path/to/${manifest.name}
\`\`\`

## Workflow

- Source deployment: ${manifest.sourceDeployment}
- Environment: ${manifest.sourceEnvironment ?? 'not specified'}
- Version: ${manifest.version}
- Current rollout stage: ${asRecord(manifest.rollout).stage ?? 'not specified'}
- Harness: ${asRecord(manifest.harness).name ?? 'not specified'}

## Included Files

${manifest.install.files.map((file) => `- \`${file}\``).join('\n')}

## Evidence

- Deployment snapshot: \`${manifest.evidence?.deploymentSnapshot ?? 'not captured'}\`
${manifest.evidence?.latestEval ? `- Latest eval: \`${manifest.evidence.latestEval}\`\n` : ''}${manifest.evidence?.deploymentReport ? `- Deployment report: \`${manifest.evidence.deploymentReport}\`\n` : ''}
`;
}
