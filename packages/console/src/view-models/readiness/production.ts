import type { AuditLogEntry } from '@fdekit/runtime';
import type {
  BudgetCapItem,
  GovernancePostureItem,
  ProductionReadinessItem,
  SnapshotTrendItem,
} from '../../interfaces/index.js';

export function createProductionReadiness(input: {
  evalStatus: string;
  policyViolationCount: number;
  approvalQueueCount: number;
  governancePosture: GovernancePostureItem[];
  budgetCaps: BudgetCapItem[];
  totalCostUsd: number;
  auditLog: AuditLogEntry[];
  snapshotTrend: SnapshotTrendItem[];
  reportReady: boolean;
  policyBlockedRunCount: number;
}): ProductionReadinessItem[] {
  const failedAuditCount = input.auditLog.filter((entry) => entry.outcome === 'failed').length;
  const maxBudget = input.budgetCaps.length > 0
    ? Math.min(...input.budgetCaps.map((budget) => budget.maxUsd))
    : undefined;
  const budgetExceeded = maxBudget !== undefined && input.totalCostUsd > maxBudget;
  const passingControls = input.governancePosture.filter((item) => item.status === 'pass').length;

  const guardrailStops: ProductionReadinessItem[] = input.policyBlockedRunCount > 0
    ? [{
      label: 'Guardrail stops',
      status: 'pass',
      detail: `Governance stopped ${input.policyBlockedRunCount} policy-blocked run(s)`,
    }]
    : [];

  return [
    {
      label: 'Eval gate',
      status: input.evalStatus === 'passed' ? 'pass' : input.evalStatus === 'not run' ? 'warn' : 'fail',
      detail: `Latest eval status is ${input.evalStatus}`,
    },
    {
      label: 'Governance controls',
      status: input.policyViolationCount === 0 && passingControls > 0 ? 'pass' : input.policyViolationCount > 0 ? 'fail' : 'warn',
      detail: `${passingControls}/${input.governancePosture.length} controls passing, ${input.policyViolationCount} latest violation(s)`,
    },
    ...guardrailStops,
    {
      label: 'Human approvals',
      status: input.approvalQueueCount === 0 ? 'pass' : 'warn',
      detail: `${input.approvalQueueCount} open approval item(s)`,
    },
    {
      label: 'Budget guardrail',
      status: budgetExceeded ? 'fail' : input.budgetCaps.length > 0 ? 'pass' : 'warn',
      detail: input.budgetCaps.length > 0
        ? `$${input.totalCostUsd.toFixed(4)} used; lowest cap $${maxBudget?.toFixed(4)}`
        : 'No budget cap configured',
    },
    {
      label: 'Audit trail',
      status: input.auditLog.length > 0 ? failedAuditCount > 0 ? 'warn' : 'pass' : 'warn',
      detail: `${input.auditLog.length} audit event(s), ${failedAuditCount} failed operation(s)`,
    },
    {
      label: 'Customer handoff',
      status: input.reportReady && input.snapshotTrend.length > 0 ? 'pass' : input.reportReady ? 'warn' : 'warn',
      detail: input.reportReady
        ? `${input.snapshotTrend.length} preserved dashboard snapshot(s)`
        : 'Generate report and dashboard snapshot before stakeholder handoff',
    },
  ];
}
