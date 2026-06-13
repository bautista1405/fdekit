import type { DeploymentDefinition } from '@fdekit/core';
import type { EvalArtifact } from '../../evals/index.js';
import type { TraceArtifact } from '../../traces/index.js';

export interface RunMacroEvalsOptions {
  deployment: DeploymentDefinition;
  traces: TraceArtifact[];
  evalArtifact?: EvalArtifact | null;
  minFrequency?: number;
  maxPatterns?: number;
  createdAt?: string;
}

export interface MacroEvalFinding {
  category: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  source: 'eval' | 'trace' | 'policy' | 'approval';
}

export interface MacroEvalTraceDocument {
  traceId: string;
  deployment: string;
  createdAt: string;
  caseType: string;
  runOutcome: string;
  evalStatus: 'passed' | 'failed' | 'unknown';
  evalFindings: MacroEvalFinding[];
  behaviorSignals: string[];
  toolCalls: string[];
  policyEvents: string[];
  approvalEvents: string[];
  finalAnswer?: string;
  compactDocument: string;
  metadata: Record<string, unknown>;
}

export interface MacroEvalSuspect {
  kind: 'tool' | 'policy' | 'approval' | 'event';
  name: string;
  count: number;
  traceIds: string[];
}

export interface MacroEvalPattern {
  id: string;
  behaviorPattern: string;
  summary: string;
  frequency: number;
  impactScore: number;
  severity: 'low' | 'medium' | 'high';
  affectedTraceIds: string[];
  caseTypes: Array<{ name: string; count: number }>;
  runOutcomes: Array<{ name: string; count: number }>;
  evalFindings: Array<{ category: string; count: number }>;
  topTools: Array<{ name: string; count: number }>;
  topPolicies: Array<{ name: string; count: number }>;
  suspects: MacroEvalSuspect[];
  representativeTraceId: string;
  recommendedInspection: string;
}

export interface MacroEvalArtifact {
  id: string;
  createdAt: string;
  deployment: string;
  source: {
    traceCount: number;
    evalArtifactId?: string;
    evalStatus?: string;
    minFrequency: number;
  };
  lowerLevelSummary: {
    evalCases: number;
    evalFailures: number;
    runOutcomes: Array<{ name: string; count: number }>;
    caseTypes: Array<{ name: string; count: number }>;
  };
  traceDocuments: MacroEvalTraceDocument[];
  patterns: MacroEvalPattern[];
  focusPattern?: MacroEvalPattern;
}
