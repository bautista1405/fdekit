import type { JsonSchema } from './tool.js';

/** Current JSON-compatible schema version for shared execution contracts. */
export const EXECUTION_CONTRACT_VERSION = 1 as const;

/** Canonical run-state vocabulary shared by the CLI, Community, Cloud, and Enterprise. */
export const EXECUTION_STATES = [
  'queued',
  'planning',
  'running',
  'needs_input',
  'needs_approval',
  'reconciling',
  'completed',
  'completed_with_limits',
  'failed',
  'cancelled',
  'expired',
] as const;

export type ExecutionState = (typeof EXECUTION_STATES)[number];

export const TERMINAL_EXECUTION_STATES = [
  'completed',
  'completed_with_limits',
  'failed',
  'cancelled',
  'expired',
] as const satisfies readonly ExecutionState[];

export type TerminalExecutionState = (typeof TERMINAL_EXECUTION_STATES)[number];

export function isExecutionState(value: unknown): value is ExecutionState {
  return typeof value === 'string' && (EXECUTION_STATES as readonly string[]).includes(value);
}

export function isTerminalExecutionState(value: unknown): value is TerminalExecutionState {
  return typeof value === 'string' && (TERMINAL_EXECUTION_STATES as readonly string[]).includes(value);
}

export class UnsupportedExecutionContractVersionError extends Error {
  readonly receivedVersion: unknown;

  constructor(receivedVersion: unknown) {
    super(
      `Unsupported execution contract version: ${String(receivedVersion)}. ` +
        `Expected ${EXECUTION_CONTRACT_VERSION}.`,
    );
    this.name = 'UnsupportedExecutionContractVersionError';
    this.receivedVersion = receivedVersion;
  }
}

export function assertExecutionContractVersion(
  version: unknown,
): asserts version is typeof EXECUTION_CONTRACT_VERSION {
  if (version !== EXECUTION_CONTRACT_VERSION) {
    throw new UnsupportedExecutionContractVersionError(version);
  }
}

/** Stable identifiers shared by Community, Cloud, and Enterprise clients. */
export interface ExecutionIdentity {
  taskId: string;
  runId: string;
  attemptId: string;
  stepId: string;
}

export interface ActorIdentity {
  id: string;
  kind: 'user' | 'service_principal' | 'external_agent' | 'system';
  displayName?: string;
  roles?: string[];
}

export interface TenantScope {
  organizationId: string;
  workspaceId?: string;
  projectId?: string;
  sourceIds?: string[];
  permissionFingerprint?: string;
  homeRegion?: string;
}

export interface TaskDescriptor {
  type: string;
  objective: string;
  inputReference?: string;
  inputSchemaVersion?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionStep {
  id: string;
  objective: string;
  index: number;
  kind?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionReference {
  sessionId: string;
  revision: number;
}

export interface VersionedExecutionRecord {
  schemaVersion: typeof EXECUTION_CONTRACT_VERSION;
  createdAt: string;
  updatedAt?: string;
  state: ExecutionState;
}

export interface TaskRecord extends VersionedExecutionRecord {
  kind: 'task';
  taskId: string;
  tenant: TenantScope;
  actor: ActorIdentity;
  descriptor: TaskDescriptor;
}

export interface RunRecord extends VersionedExecutionRecord {
  kind: 'run';
  taskId: string;
  runId: string;
}

export interface AttemptRecord extends VersionedExecutionRecord {
  kind: 'attempt';
  taskId: string;
  runId: string;
  attemptId: string;
  attemptNumber: number;
}

export interface StepRecord extends VersionedExecutionRecord {
  kind: 'step';
  identity: ExecutionIdentity;
  step: ExecutionStep;
}

export type ExecutionRecord = TaskRecord | RunRecord | AttemptRecord | StepRecord;

export interface ExecutionErrorRecord {
  code: string;
  message: string;
  retryable: boolean;
  category?: 'configuration' | 'policy' | 'input' | 'provider' | 'tool' | 'system';
  details?: Record<string, unknown>;
}

export interface SourceSnapshot {
  sourceId: string;
  revision: string;
  checksum?: string;
  observedAt: string;
  permissionFingerprint?: string;
  metadata?: Record<string, unknown>;
}

export interface ContextBudget {
  maxInputTokens: number;
  maxOutputTokens?: number;
  maxLatencyMs?: number;
  maxDurationMs?: number;
  maxCost?: number;
  maxToolCalls?: number;
  maxRetrievalItems?: number;
  maxDelegations?: number;
  reservedTokens?: number;
}

export interface ContextObjectives {
  relevance: number;
  freshness: number;
  authority: number;
  completeness: number;
  latency: number;
  cost: number;
}

export type ContextItemKind = 'instruction' | 'evidence' | 'memory' | 'recent_action';

export interface ContextItem {
  id: string;
  kind: ContextItemKind;
  content: string;
  classification?: string;
  sourceIds?: string[];
  provenanceIds?: string[];
  tokenEstimate?: number;
  observedAt?: string;
  validFrom?: string;
  validTo?: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceItem extends ContextItem {
  kind: 'evidence';
  sourceRevision?: string;
  authority?: number;
  freshness?: number;
}

export interface MemoryItem extends ContextItem {
  kind: 'memory';
  scope: 'user' | 'agent' | 'session' | 'organization';
}

export interface ActionRecord extends ContextItem {
  kind: 'recent_action';
  action: string;
  outcome: 'observed' | 'committed' | 'reconciled' | 'failed' | 'unknown';
}

export interface SkillReference {
  name: string;
  version: string;
  digest?: string;
}

export interface ModelToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * The only context payload eligible for provider serialization.
 *
 * Host identity, policy internals, excluded-source topology, trace internals,
 * and reusable credentials deliberately do not exist on this interface.
 */
export interface ModelContext {
  schemaVersion: typeof EXECUTION_CONTRACT_VERSION;
  instructions: ContextItem[];
  evidence: EvidenceItem[];
  memory: MemoryItem[];
  skills: SkillReference[];
  tools: ModelToolDefinition[];
  recentActions: ActionRecord[];
}

export interface ProvenanceRecord {
  schemaVersion: typeof EXECUTION_CONTRACT_VERSION;
  id: string;
  source: string;
  recordedAt: string;
  sourceSnapshot?: SourceSnapshot;
  sourceRevision?: string;
  observedAt?: string;
  checksum?: string;
  effectiveAt?: string;
  confidence?: number;
  confirmation?: 'observed' | 'inferred' | 'human_confirmed';
  metadata?: Record<string, unknown>;
}

export interface TraceContext {
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  traceFlags?: string;
}

export type PolicyCapability =
  | 'source:read'
  | 'tool:execute'
  | 'external:write'
  | 'artifact:publish'
  | (string & {});

export interface PolicyConstraint {
  kind: string;
  value: unknown;
  description?: string;
}

export interface PolicyDecisionEvidence {
  id: string;
  decision: 'allow' | 'deny' | 'needs_approval';
  reason: string;
  capability?: PolicyCapability;
  policyReference?: string;
  evaluatedAt: string;
}

export interface EffectivePolicy {
  schemaVersion: typeof EXECUTION_CONTRACT_VERSION;
  version: string;
  fingerprint: string;
  evaluatedAt: string;
  decision: 'allow' | 'deny' | 'needs_approval';
  capabilities: PolicyCapability[];
  approvalRequiredFor: PolicyCapability[];
  sourceAllowlist?: string[];
  targetAllowlist?: string[];
  constraints?: PolicyConstraint[];
  evidence?: PolicyDecisionEvidence[];
  budget: ContextBudget;
  reasons: string[];
}

/** Host-only control envelope. Only `model` may be compiled for a provider. */
export interface ContextEnvelope {
  schemaVersion: typeof EXECUTION_CONTRACT_VERSION;
  identity: ExecutionIdentity;
  tenant: TenantScope;
  actor: ActorIdentity;
  task: TaskDescriptor;
  step: ExecutionStep;
  session: SessionReference;
  budget: ContextBudget;
  objectives: ContextObjectives;
  policy: EffectivePolicy;
  provenance: ProvenanceRecord[];
  trace: TraceContext;
  model: ModelContext;
}

export interface ArtifactProducer {
  name: string;
  version: string;
  schemaVersion?: string;
}

export interface ArtifactReference {
  artifactId: string;
  version: number;
  checksum: string;
  uri?: string;
}

export interface ArtifactDescriptor extends ArtifactReference {
  schemaVersion: typeof EXECUTION_CONTRACT_VERSION;
  identity: ExecutionIdentity;
  type: string;
  contentType: string;
  producer: ArtifactProducer;
  createdAt: string;
  sizeBytes?: number;
  sourceSnapshots?: SourceSnapshot[];
  metadata?: Record<string, unknown>;
}

/** Immutable identity for an external effect before it is approved or executed. */
export interface PlannedAction {
  schemaVersion: typeof EXECUTION_CONTRACT_VERSION;
  actionId: string;
  identity: ExecutionIdentity;
  capability: PolicyCapability;
  target: string;
  operation: string;
  argumentsDigest: string;
  sourceSnapshots: SourceSnapshot[];
  idempotencyKey: string;
  plannedAt: string;
  blastRadius?: string;
  metadata?: Record<string, unknown>;
}

export type ApprovalRequestStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'cancelled';

export interface ApprovalDecisionRecord {
  decisionId: string;
  decision: 'approved' | 'denied';
  decidedAt: string;
  decidedBy: ActorIdentity;
  reason?: string;
  plannedActionDigest: string;
}

export interface ApprovalRequestRecord {
  schemaVersion: typeof EXECUTION_CONTRACT_VERSION;
  requestId: string;
  identity: ExecutionIdentity;
  session: SessionReference;
  status: ApprovalRequestStatus;
  requestedAt: string;
  requestedBy: ActorIdentity;
  plannedAction: PlannedAction;
  decision?: ApprovalDecisionRecord;
  expiresAt?: string;
}

export type InputRequestStatus = 'pending' | 'answered' | 'expired' | 'cancelled';

export interface InputRequestRecord<Value = unknown> {
  schemaVersion: typeof EXECUTION_CONTRACT_VERSION;
  requestId: string;
  identity: ExecutionIdentity;
  session: SessionReference;
  status: InputRequestStatus;
  prompt: string;
  inputSchema: JsonSchema<Value>;
  requestedAt: string;
  requestedBy: ActorIdentity;
  audience?: ActorIdentity[];
  disclosure?: 'public' | 'organization' | 'restricted';
  deadlineAt?: string;
  defaultValue?: Value;
  resumeTokenDigest?: string;
}

export interface InputAnswerRecord<Value = unknown> {
  schemaVersion: typeof EXECUTION_CONTRACT_VERSION;
  requestId: string;
  answerId: string;
  value: Value;
  answeredAt: string;
  answeredBy: ActorIdentity;
}

export interface UsageMeasurement {
  schemaVersion: typeof EXECUTION_CONTRACT_VERSION;
  measuredAt: string;
  identity?: Partial<ExecutionIdentity>;
  provider?: string;
  model?: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  toolCalls?: number;
  latencyMs?: number;
  cost?: number;
  currency?: string;
  status: 'unknown' | 'estimated' | 'measured';
  metadata?: Record<string, unknown>;
}
