import type { EnvironmentName } from './shared.js';

export interface AuditLogConfig {
  enabled?: boolean;
  retentionDays?: number;
  includeMetadata?: boolean;
  redactSensitive?: boolean;
}

export interface EnvironmentSeparationConfig {
  allowed?: EnvironmentName[];
  denied?: EnvironmentName[];
  tools?: string[];
  description?: string;
}

export interface BudgetCapDefinition {
  name?: string;
  description?: string;
  scope?: 'deployment' | `agent:${string}` | `provider:${string}` | `tool:${string}` | (string & {});
  maxUsd: number;
}

export interface PermissionScopeDefinition {
  name: string;
  description?: string;
  risk?: 'low' | 'medium' | 'high';
}

export interface PermissionGrantDefinition {
  name?: string;
  description?: string;
  agent?: string;
  tools?: string[];
  scopes: string[];
  deniedScopes?: string[];
  requireScopes?: boolean;
}

export interface PermissionScopesConfig {
  scopes?: PermissionScopeDefinition[];
  allowedScopes?: string[];
  deniedScopes?: string[];
  grants?: PermissionGrantDefinition[];
  requireScopes?: boolean;
}

export interface DataProtectionConfig {
  denyPII?: boolean | {
    description?: string;
    patterns?: RegExp[];
  };
  redactSecrets?: boolean | {
    description?: string;
    replacement?: string;
    patterns?: RegExp[];
  };
}

export interface GovernanceDefinition {
  audit?: AuditLogConfig;
  environments?: EnvironmentSeparationConfig;
  budgets?: BudgetCapDefinition[];
  permissions?: PermissionScopesConfig;
  dataProtection?: DataProtectionConfig;
  metadata?: Record<string, unknown>;
}
