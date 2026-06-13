import { definePolicy } from '../definitions/index.js';
import type { EnvironmentName, PolicyDecision, PolicyDefinition } from '../types/index.js';

export function allow(metadata?: Record<string, unknown>): PolicyDecision {
  return { allowed: true, metadata };
}

export function deny(reason: string, metadata?: Record<string, unknown>): PolicyDecision {
  return { allowed: false, reason, metadata };
}

export function requireApproval(options: {
  name?: string;
  description?: string;
  tools?: string[];
  reason?: string;
} = {}): PolicyDefinition {
  const tools = new Set(options.tools ?? []);

  return definePolicy({
    name: options.name ?? 'require-approval',
    description: options.description ?? 'Require human approval before selected tool calls',
    metadata: {
      kind: 'approval',
      tools: options.tools ?? [],
    },
    beforeToolCall(toolName) {
      if (tools.size > 0 && !tools.has(toolName)) {
        return allow();
      }

      return {
        allowed: false,
        approvalRequired: true,
        reason: options.reason ?? `Tool call "${toolName}" requires approval`,
      };
    },
  });
}

export function denyPIILeak(options: {
  name?: string;
  description?: string;
  patterns?: RegExp[];
} = {}): PolicyDefinition {
  const patterns = options.patterns ?? [
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /\b\d{3}-\d{2}-\d{4}\b/,
    /\b(?:\d[ -]*?){13,16}\b/,
  ];

  const check = (value: unknown) => {
    const text = stringifyForPolicy(value);
    const matched = patterns.find((pattern) => pattern.test(text));

    return matched
      ? deny('Potential PII detected', { pattern: matched.source })
      : allow();
  };

  return definePolicy({
    name: options.name ?? 'deny-pii-leak',
    description: options.description ?? 'Deny tool inputs and outputs that appear to contain PII',
    metadata: {
      kind: 'data-protection',
      pii: true,
    },
    beforeToolCall: (_toolName, args) => check(args),
    afterToolCall: (_toolName, result) => check(result),
  });
}

export function limitToolUse(options: {
  maxCalls: number;
  name?: string;
  description?: string;
  tools?: string[];
}): PolicyDefinition {
  const tools = new Set(options.tools ?? []);

  return definePolicy({
    name: options.name ?? 'limit-tool-use',
    description: options.description ?? `Limit tool calls to ${options.maxCalls}`,
    metadata: {
      kind: 'tool-limit',
      maxCalls: options.maxCalls,
      tools: options.tools ?? [],
    },
    beforeToolCall(toolName, _args, context) {
      if (tools.size > 0 && !tools.has(toolName)) {
        return allow();
      }

      const count = context.toolCallCount ?? 0;
      return count >= options.maxCalls
        ? deny(`Tool call limit exceeded: ${count}/${options.maxCalls}`)
        : allow();
    },
  });
}

export function limitCost(options: {
  maxUsd: number;
  name?: string;
  description?: string;
}): PolicyDefinition {
  return definePolicy({
    name: options.name ?? 'limit-cost',
    description: options.description ?? `Limit run cost to $${options.maxUsd}`,
    metadata: {
      kind: 'budget',
      maxUsd: options.maxUsd,
    },
    beforeToolCall(_toolName, _args, context) {
      const cost = context.costUsd ?? 0;
      return cost >= options.maxUsd
        ? deny(`Cost limit exceeded: $${cost.toFixed(4)} / $${options.maxUsd.toFixed(4)}`)
        : allow();
    },
  });
}

export function restrictTables(options: {
  allowed?: string[];
  denied?: string[];
  name?: string;
  description?: string;
}): PolicyDefinition {
  const allowed = new Set((options.allowed ?? []).map((table) => table.toLowerCase()));
  const denied = new Set((options.denied ?? []).map((table) => table.toLowerCase()));

  return definePolicy({
    name: options.name ?? 'restrict-tables',
    description: options.description ?? 'Restrict database tool calls to approved tables',
    metadata: {
      kind: 'table-access',
      allowedTables: options.allowed ?? [],
      deniedTables: options.denied ?? [],
    },
    beforeToolCall(_toolName, args) {
      const tables = extractTableNames(args);
      const deniedHit = tables.find((table) => denied.has(table));

      if (deniedHit) {
        return deny(`Table "${deniedHit}" is denied`);
      }

      const disallowed = allowed.size > 0
        ? tables.find((table) => !allowed.has(table))
        : undefined;

      return disallowed
        ? deny(`Table "${disallowed}" is not in the allowed table list`)
        : allow({ tables });
    },
  });
}

export function limitToolScopes(options: {
  allowed: string[];
  denied?: string[];
  tools?: string[];
  requireScopes?: boolean;
  name?: string;
  description?: string;
}): PolicyDefinition {
  const allowed = new Set(options.allowed);
  const denied = new Set(options.denied ?? []);
  const tools = new Set(options.tools ?? []);

  return definePolicy({
    name: options.name ?? 'limit-tool-scopes',
    description: options.description ?? 'Restrict tool calls to granted permission scopes',
    metadata: {
      kind: 'tool-permissions',
      allowedScopes: options.allowed,
      deniedScopes: options.denied ?? [],
      tools: options.tools ?? [],
      requireScopes: options.requireScopes ?? false,
    },
    beforeToolCall(toolName, _args, context) {
      if (tools.size > 0 && !tools.has(toolName)) {
        return allow();
      }

      const scopes = context.toolScopes ?? [];

      if ((options.requireScopes ?? false) && scopes.length === 0) {
        return deny(`Tool "${toolName}" does not declare permission scopes`, { scopes });
      }

      const deniedHit = scopes.find((scope) => denied.has(scope));
      if (deniedHit) {
        return deny(`Tool scope "${deniedHit}" is denied`, { scopes, deniedScope: deniedHit });
      }

      const missing = scopes.filter((scope) => !allowed.has(scope));
      return missing.length > 0
        ? deny(`Tool "${toolName}" requires ungranted scope(s): ${missing.join(', ')}`, {
          scopes,
          missingScopes: missing,
          allowedScopes: options.allowed,
        })
        : allow({ scopes, allowedScopes: options.allowed });
    },
  });
}

export function restrictEnvironments(options: {
  allowed?: EnvironmentName[];
  denied?: EnvironmentName[];
  tools?: string[];
  name?: string;
  description?: string;
}): PolicyDefinition {
  const allowed = new Set(options.allowed ?? []);
  const denied = new Set(options.denied ?? []);
  const tools = new Set(options.tools ?? []);

  return definePolicy({
    name: options.name ?? 'restrict-environments',
    description: options.description ?? 'Restrict selected tool calls by deployment environment',
    metadata: {
      kind: 'environment-separation',
      allowedEnvironments: options.allowed ?? [],
      deniedEnvironments: options.denied ?? [],
      tools: options.tools ?? [],
    },
    beforeToolCall(toolName, _args, context) {
      if (tools.size > 0 && !tools.has(toolName)) {
        return allow();
      }

      const environment = context.environment ?? 'local';

      if (denied.has(environment)) {
        return deny(`Tool "${toolName}" is denied in ${environment}`, { environment });
      }

      if (allowed.size > 0 && !allowed.has(environment)) {
        return deny(`Tool "${toolName}" is only allowed in: ${[...allowed].join(', ')}; current environment: ${environment}`, {
          environment,
          allowedEnvironments: [...allowed],
        });
      }

      return allow({ environment });
    },
  });
}

export function redactSecrets(options: {
  name?: string;
  description?: string;
  replacement?: string;
  patterns?: RegExp[];
} = {}): PolicyDefinition {
  const replacement = options.replacement ?? '[REDACTED]';
  const patterns = options.patterns ?? [
    /(?:api[_-]?key|token|secret|password)["'\s:=]+([A-Za-z0-9_\-./+=]{8,})/gi,
    /\b(?:sk|pk)-[A-Za-z0-9]{16,}\b/g,
  ];

  const redact = (value: unknown) => {
    const text = stringifyForPolicy(value);
    const redacted = patterns.reduce(
      (current, pattern) => current.replace(pattern, replacement),
      text,
    );

    return allow({ redacted, changed: redacted !== text });
  };

  return definePolicy({
    name: options.name ?? 'redact-secrets',
    description: options.description ?? 'Mark secret-like values for redaction in traces and reports',
    metadata: {
      kind: 'secret-redaction',
    },
    beforeToolCall: (_toolName, args) => redact(args),
    afterToolCall: (_toolName, result) => redact(result),
  });
}

function stringifyForPolicy(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractTableNames(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const tables = new Set<string>();
  const add = (table: unknown) => {
    if (typeof table === 'string' && table.trim()) {
      tables.add(table.trim().toLowerCase());
    }
  };

  add(record.table);

  if (Array.isArray(record.tables)) {
    for (const table of record.tables) {
      add(table);
    }
  }

  if (typeof record.query === 'string') {
    const query = record.query;
    const pattern = /\b(?:from|join|update|into)\s+([a-zA-Z_][a-zA-Z0-9_.$]*)/gi;
    let match = pattern.exec(query);

    while (match) {
      add(match[1]);
      match = pattern.exec(query);
    }
  }

  return [...tables];
}
