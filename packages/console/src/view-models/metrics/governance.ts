import type { ConsoleMetrics } from '../../interfaces/index.js';
import {
  collectApprovalQueue,
  collectBudgetCaps,
  collectGovernancePosture,
  collectPolicyDefinitions,
  collectPolicyEvents,
} from '../governance.js';
import type { MetricsContext } from './context.js';

export type GovernanceMetrics = Pick<
  ConsoleMetrics,
  | 'policyEvaluations'
  | 'policyDefinitions'
  | 'governancePosture'
  | 'budgetCaps'
  | 'approvalQueue'
  | 'auditLog'
  | 'auditEventCount'
  | 'policyEvents'
> & {
  openApprovalCount: number;
};

export function collectGovernanceMetrics(context: MetricsContext): GovernanceMetrics {
  const policyDefinitions = collectPolicyDefinitions(context.data.deployment);
  const budgetCaps = collectBudgetCaps(policyDefinitions, context.data.deployment);
  const policyEventItems = collectPolicyEvents(context.traces);
  const approvalQueue = collectApprovalQueue(policyEventItems, context.approvals);
  const auditLog = [...context.auditLog].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return {
    policyEvaluations: context.policyEvents.length,
    policyDefinitions,
    governancePosture: collectGovernancePosture(context.data.deployment, policyDefinitions, budgetCaps, auditLog.length),
    budgetCaps,
    approvalQueue,
    auditLog,
    auditEventCount: auditLog.length,
    policyEvents: policyEventItems,
    openApprovalCount: approvalQueue.filter((approval) => approval.status !== 'approved').length,
  };
}
