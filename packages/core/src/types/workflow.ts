export type WorkflowSignalRating = 'low' | 'medium' | 'high' | 'unknown' | (string & {});

export interface WorkflowStateDefinition {
  summary?: string;
  handoffs?: string[];
  baseline?: {
    cycleTime?: string;
    manualSteps?: number;
    cost?: string;
    errorRate?: string;
    [key: string]: unknown;
  };
  evidence?: string[];
  target?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowScorecardDefinition {
  volume?: WorkflowSignalRating;
  manualEffort?: WorkflowSignalRating;
  fragmentedSystems?: string[];
  repeatableDecisions?: WorkflowSignalRating;
  measurablePain?: string[];
  riskBoundary?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowDefinition {
  name: string;
  owner?: string;
  description?: string;
  currentState?: WorkflowStateDefinition;
  targetState?: WorkflowStateDefinition;
  scorecard?: WorkflowScorecardDefinition;
  metadata?: Record<string, unknown>;
}

export interface OutcomeMetricDefinition {
  name: string;
  description?: string;
  baseline?: string;
  target?: string;
  source?: string;
  unit?: string;
  owner?: string;
  metadata?: Record<string, unknown>;
}

export interface DataLayersDefinition {
  systemOfRecord?: string[];
  businessRules?: string[];
  rawIntake?: string[];
  feedback?: string[];
  metadata?: Record<string, unknown>;
}

export type RolloutStageName =
  | 'local'
  | 'sandbox'
  | 'customer-sample'
  | 'shadow'
  | 'approved-write'
  | 'production-allowlist'
  | 'production'
  | (string & {});

export interface RolloutDefinition {
  stage: RolloutStageName;
  stages?: RolloutStageName[];
  next?: string;
  owner?: string;
  metadata?: Record<string, unknown>;
}
