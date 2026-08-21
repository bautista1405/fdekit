import type {
  ContextBudget,
  InferenceTarget,
  ProvenanceRecord,
  RetrievalAuthorizationPlan,
  SourceSnapshot,
  UsageMeasurement,
} from '@fdekit/core';

export interface IngestionDocument {
  documentId: string;
  sourceSnapshot: SourceSnapshot;
  content: string;
  title?: string;
  contentType?: string;
  classification?: string;
  metadata?: Record<string, unknown>;
  /** Optional caller-produced embedding; FDEKit does not invoke an embedding model implicitly. */
  embedding?: number[];
}

export interface IngestionChunk {
  chunkId: string;
  documentId: string;
  sourceSnapshot: SourceSnapshot;
  content: string;
  index: number;
  startOffset: number;
  endOffset: number;
  title?: string;
  classification?: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}

export interface ChunkingOptions {
  maxCharacters?: number;
  overlapCharacters?: number;
}

export type RetrievalMode = 'exact' | 'full_text' | 'vector' | 'hybrid';

export interface RetrievalQuery {
  mode: RetrievalMode;
  text?: string;
  embedding?: number[];
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface RetrievalResult {
  chunk: IngestionChunk;
  score: number;
  lexicalScore: number;
  vectorScore?: number;
}

export interface RetrievalStore {
  replaceSource(sourceSnapshot: SourceSnapshot, documents: IngestionDocument[]): void;
  removeSource(sourceId: string): number;
  search(query: RetrievalQuery, authorization: RetrievalAuthorizationPlan): RetrievalResult[];
  size(): number;
}

export type MemoryKind = 'working' | 'episodic';
export type MemoryScope = 'user' | 'agent' | 'session' | 'organization';

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  scope: MemoryScope;
  scopeId: string;
  content: string;
  createdAt: string;
  expiresAt?: string;
  sourceIds?: string[];
  provenanceIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface MemoryQuery {
  scope: MemoryScope;
  scopeId: string;
  kind?: MemoryKind;
  text?: string;
  limit?: number;
}

export interface MemoryStore {
  put(record: MemoryRecord): void;
  get(id: string, authorization: RetrievalAuthorizationPlan): MemoryRecord | null;
  query(query: MemoryQuery, authorization: RetrievalAuthorizationPlan): MemoryRecord[];
  remove(id: string): boolean;
}

export interface KnowledgeEntity {
  id: string;
  type: string;
  name: string;
  attributes?: Record<string, unknown>;
  sourceSnapshots: SourceSnapshot[];
  provenance: ProvenanceRecord[];
  confidence: number;
  confirmation: 'observed' | 'inferred' | 'human_confirmed';
  updatedAt: string;
}

export interface KnowledgeRelation {
  id: string;
  type: string;
  fromEntityId: string;
  toEntityId: string;
  sourceSnapshots: SourceSnapshot[];
  provenance: ProvenanceRecord[];
  confidence: number;
  confirmation: 'observed' | 'inferred' | 'human_confirmed';
  validFrom?: string;
  validTo?: string;
  updatedAt: string;
}

export interface KnowledgeNeighborhood {
  entities: KnowledgeEntity[];
  relations: KnowledgeRelation[];
}

export interface KnowledgeStore {
  putEntity(entity: KnowledgeEntity): void;
  putRelation(relation: KnowledgeRelation): void;
  getEntity(id: string, authorization: RetrievalAuthorizationPlan): KnowledgeEntity | null;
  neighbors(entityId: string, authorization: RetrievalAuthorizationPlan): KnowledgeNeighborhood;
  removeSource(sourceId: string): { entities: number; relations: number };
}

export interface CacheIdentity {
  namespace: string;
  key: string;
  tenantFingerprint: string;
  policyFingerprint: string;
  targetFingerprint?: string;
  sourceRevisions?: Record<string, string>;
}

export interface CacheEntry<Value = unknown> {
  identity: CacheIdentity;
  value: Value;
  createdAt: string;
  expiresAt?: string;
}

export interface PolicyAwareCache {
  set<Value>(entry: CacheEntry<Value>): void;
  get<Value>(identity: CacheIdentity): CacheEntry<Value> | null;
  invalidateSource(sourceId: string, currentRevision?: string): number;
  clearNamespace(namespace: string): number;
  size(): number;
}

export interface EstimateInferenceUsageInput {
  target: InferenceTarget;
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
  reasoningTokens?: number;
  toolCalls?: number;
  latencyMs?: number;
  measuredAt?: string;
}

export interface UsageSummary {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  toolCalls: number;
  latencyMs: number;
  cost: number;
  measuredCount: number;
  estimatedCount: number;
  unknownCount: number;
  currencies: string[];
}

export interface BudgetEvaluation {
  allowed: boolean;
  violations: Array<'input_tokens' | 'output_tokens' | 'tool_calls' | 'latency' | 'cost' | 'currency'>;
  summary: UsageSummary;
  budget: ContextBudget;
}

export interface UsageLedger {
  record(measurement: UsageMeasurement): void;
  measurements(): UsageMeasurement[];
  summary(): UsageSummary;
  evaluate(budget: ContextBudget): BudgetEvaluation;
}
