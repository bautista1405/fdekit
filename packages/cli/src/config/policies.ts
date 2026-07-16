import { escapeSingleQuoted } from '../utils/strings.js';

export function policyExpressionFor(name: string): { imports: string[]; expression: string } {
  switch (name) {
    case 'requireApproval':
    case 'require-approval':
      return { imports: ['requireApproval'], expression: 'requireApproval()' };
    case 'denyPIILeak':
    case 'deny-pii-leak':
      return { imports: ['denyPIILeak'], expression: 'denyPIILeak()' };
    case 'limitToolUse':
    case 'limit-tool-use':
      return { imports: ['limitToolUse'], expression: 'limitToolUse({ maxCalls: 8 })' };
    case 'limitCost':
    case 'limit-cost':
      return { imports: ['limitCost'], expression: 'limitCost({ maxUsd: 0.25 })' };
    case 'limitToolScopes':
    case 'limit-tool-scopes':
      return { imports: ['limitToolScopes'], expression: "limitToolScopes({ allowed: ['customer:read', 'ticket:read', 'issues:write'] })" };
    case 'restrictEnvironments':
    case 'restrict-environments':
      return { imports: ['restrictEnvironments'], expression: "restrictEnvironments({ allowed: ['local', 'development', 'staging'] })" };
    case 'restrictTables':
    case 'restrict-tables':
      return { imports: ['restrictTables'], expression: "restrictTables({ allowed: ['customers', 'tickets'] })" };
    case 'redactSecrets':
    case 'redact-secrets':
      return { imports: ['redactSecrets'], expression: 'redactSecrets()' };
    default:
      // A named policy with no hooks would validate and silently do nothing, so
      // scaffold a beforeToolCall skeleton that teaches the contract instead.
      return {
        imports: ['definePolicy'],
        expression: `definePolicy({
  name: '${escapeSingleQuoted(name)}',
  description: 'TODO: describe what this policy enforces',
  beforeToolCall(toolName, args, context) {
    // TODO: inspect toolName/args/context and enforce your rule. Return:
    //   { allowed: true }                                         to allow the call
    //   { allowed: false, reason: 'why' }                         to block it
    //   { allowed: false, approvalRequired: true, reason: 'why' } to pause for human approval
    return { allowed: true };
  },
})`,
      };
  }
}
