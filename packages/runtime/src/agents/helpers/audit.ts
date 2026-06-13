import { appendAuditLog } from '../../governance/index.js';
import type { RunState } from './types.js';

export interface AgentAuditInput {
  action: string;
  outcome: 'requested' | 'allowed' | 'blocked' | 'succeeded' | 'failed' | 'approved' | 'rejected';
  toolName?: string;
  policy?: string;
  approvalId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export async function appendAudit(
  state: RunState,
  input: AgentAuditInput,
): Promise<void> {
  if (state.deployment.governance?.audit?.enabled === false) {
    return;
  }

  await appendAuditLog(state.projectDir, {
    deployment: state.deployment.name,
    environment: state.deployment.environment,
    agent: state.agentName,
    runId: state.runId,
    traceId: state.runId,
    actor: 'agent',
    ...input,
  }, state.artifactStore);
}
