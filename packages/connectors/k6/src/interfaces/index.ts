export type K6ConnectorMode = 'local' | 'k6';

export type K6Scenario = 'smoke' | 'baseline' | 'stress' | 'spike' | (string & {});

export interface K6ConnectorConfig extends Record<string, unknown> {
  mode: K6ConnectorMode;
  scriptPath: string;
  workingDir: string;
  targetUrl: string;
  targetUrlEnv: string;
  summaryPath: string;
  k6Command: string;
  defaultVus: number;
  defaultDuration: string;
  maxVus: number;
  maxDurationSeconds: number;
  thresholds: {
    p95Ms: number;
    errorRate: number;
  };
}

export interface K6ConnectorOptions {
  mode?: K6ConnectorMode;
  scriptPath?: string;
  workingDir?: string;
  targetUrl?: string;
  targetUrlEnv?: string;
  summaryPath?: string;
  k6Command?: string;
  defaultVus?: number;
  defaultDuration?: string;
  maxVus?: number;
  maxDurationSeconds?: number;
  p95ThresholdMs?: number;
  errorRateThreshold?: number;
  env?: Record<string, string | undefined>;
  now?: () => string;
  runCommand?: (command: K6CommandInvocation) => Promise<K6CommandResult>;
}

export interface K6CommandInvocation {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
  timeoutMs: number;
}

export interface K6CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface K6RunArgs {
  scenario?: K6Scenario;
  targetUrl?: string;
  scriptPath?: string;
  vus?: number;
  duration?: string;
  summaryPath?: string;
  tags?: Record<string, string>;
}

export interface K6RunResult {
  mode: K6ConnectorMode;
  status: 'passed' | 'failed';
  scenario: K6Scenario;
  targetUrl: string;
  scriptPath: string;
  vus: number;
  duration: string;
  summaryPath: string;
  command?: string;
  exitCode: number;
  startedAt: string;
  latencyMs: number;
  metrics: {
    httpReqDurationP95Ms: number;
    httpReqFailedRate: number;
    checksSucceededRate: number;
    iterations: number;
    requests: number;
  };
  thresholds: {
    p95Ms: number;
    errorRate: number;
    passed: boolean;
  };
  stdout?: string;
  stderr?: string;
}
