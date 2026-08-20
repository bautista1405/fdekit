import { createHash } from 'crypto';
import type { RetrievalAuthorizationPlan, UsageMeasurement } from '@fdekit/core';
import type {
  BudgetEvaluation,
  CacheEntry,
  CacheIdentity,
  ChunkingOptions,
  EstimateInferenceUsageInput,
  IngestionChunk,
  IngestionDocument,
  KnowledgeEntity,
  KnowledgeNeighborhood,
  KnowledgeRelation,
  KnowledgeStore,
  MemoryQuery,
  MemoryRecord,
  MemoryStore,
  PolicyAwareCache,
  RetrievalQuery,
  RetrievalResult,
  RetrievalStore,
  UsageLedger,
  UsageSummary,
} from './types.js';

export class LocalRetrievalIndex implements RetrievalStore {
  readonly #chunks = new Map<string, IngestionChunk>();
  readonly #chunking: Required<ChunkingOptions>;

  constructor(options: ChunkingOptions = {}) {
    const maxCharacters = options.maxCharacters ?? 1_200;
    const overlapCharacters = options.overlapCharacters ?? 120;
    if (!Number.isInteger(maxCharacters) || maxCharacters < 64) {
      throw new Error('maxCharacters must be an integer of at least 64.');
    }
    if (!Number.isInteger(overlapCharacters) || overlapCharacters < 0 || overlapCharacters >= maxCharacters) {
      throw new Error('overlapCharacters must be a non-negative integer smaller than maxCharacters.');
    }
    this.#chunking = { maxCharacters, overlapCharacters };
  }

  replaceSource(sourceSnapshot: IngestionDocument['sourceSnapshot'], documents: IngestionDocument[]): void {
    for (const document of documents) {
      if (
        document.sourceSnapshot.sourceId !== sourceSnapshot.sourceId
        || document.sourceSnapshot.revision !== sourceSnapshot.revision
      ) {
        throw new Error(`Document ${document.documentId} does not match the replacement source snapshot.`);
      }
    }
    this.removeSource(sourceSnapshot.sourceId);
    for (const document of documents) {
      for (const chunk of chunkDocument(document, this.#chunking)) this.#chunks.set(chunk.chunkId, chunk);
    }
  }

  removeSource(sourceId: string): number {
    let removed = 0;
    for (const [id, chunk] of this.#chunks) {
      if (chunk.sourceSnapshot.sourceId === sourceId) {
        this.#chunks.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  search(query: RetrievalQuery, authorization: RetrievalAuthorizationPlan): RetrievalResult[] {
    validateRetrievalQuery(query);
    if (authorization.decision !== 'allow') return [];
    const normalizedText = query.text?.trim().toLowerCase() ?? '';
    const queryTerms = tokenize(normalizedText);
    const results: RetrievalResult[] = [];

    for (const chunk of this.#chunks.values()) {
      if (!authorization.allowedSourceIds.includes(chunk.sourceSnapshot.sourceId)) continue;
      if (!matchesFilters(chunk, query.filters)) continue;
      const lexicalScore = lexicalMatch(chunk.content, normalizedText, queryTerms, query.mode);
      const vectorScore = query.embedding && chunk.embedding
        ? cosineSimilarity(query.embedding, chunk.embedding)
        : undefined;
      const score = combinedScore(query.mode, lexicalScore, vectorScore);
      if (score <= 0) continue;
      results.push({ chunk: clone(chunk), score, lexicalScore, ...(vectorScore === undefined ? {} : { vectorScore }) });
    }

    return results
      .sort((left, right) => right.score - left.score || left.chunk.chunkId.localeCompare(right.chunk.chunkId))
      .slice(0, query.limit ?? 10);
  }

  size(): number {
    return this.#chunks.size;
  }
}

export class LocalMemoryStore implements MemoryStore {
  readonly #records = new Map<string, MemoryRecord>();
  readonly #now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.#now = options.now ?? (() => new Date());
  }

  put(record: MemoryRecord): void {
    assertTimestamp(record.createdAt, 'memory createdAt');
    if (record.expiresAt) assertTimestamp(record.expiresAt, 'memory expiresAt');
    this.#records.set(record.id, clone(record));
  }

  get(id: string, authorization: RetrievalAuthorizationPlan): MemoryRecord | null {
    const record = this.#records.get(id);
    return record && !isExpired(record.expiresAt, this.#now()) && authorized(record.sourceIds, authorization)
      ? clone(record)
      : null;
  }

  query(query: MemoryQuery, authorization: RetrievalAuthorizationPlan): MemoryRecord[] {
    const terms = tokenize(query.text ?? '');
    return [...this.#records.values()]
      .filter((record) => record.scope === query.scope && record.scopeId === query.scopeId)
      .filter((record) => !query.kind || record.kind === query.kind)
      .filter((record) => !isExpired(record.expiresAt, this.#now()))
      .filter((record) => authorized(record.sourceIds, authorization))
      .map((record) => ({ record, score: terms.length === 0 ? 1 : termCoverage(record.content, terms) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || right.record.createdAt.localeCompare(left.record.createdAt))
      .slice(0, query.limit ?? 10)
      .map((entry) => clone(entry.record));
  }

  remove(id: string): boolean {
    return this.#records.delete(id);
  }
}

export class LocalKnowledgeStore implements KnowledgeStore {
  readonly #entities = new Map<string, KnowledgeEntity>();
  readonly #relations = new Map<string, KnowledgeRelation>();

  putEntity(entity: KnowledgeEntity): void {
    assertConfidence(entity.confidence);
    this.#entities.set(entity.id, clone(entity));
  }

  putRelation(relation: KnowledgeRelation): void {
    assertConfidence(relation.confidence);
    if (!this.#entities.has(relation.fromEntityId) || !this.#entities.has(relation.toEntityId)) {
      throw new Error(`Knowledge relation ${relation.id} references an unknown entity.`);
    }
    this.#relations.set(relation.id, clone(relation));
  }

  getEntity(id: string, authorization: RetrievalAuthorizationPlan): KnowledgeEntity | null {
    const entity = this.#entities.get(id);
    return entity && authorized(entity.sourceSnapshots.map((snapshot) => snapshot.sourceId), authorization)
      ? clone(entity)
      : null;
  }

  neighbors(entityId: string, authorization: RetrievalAuthorizationPlan): KnowledgeNeighborhood {
    const center = this.getEntity(entityId, authorization);
    if (!center) return { entities: [], relations: [] };
    const relations = [...this.#relations.values()]
      .filter((relation) => relation.fromEntityId === entityId || relation.toEntityId === entityId)
      .filter((relation) => authorized(relation.sourceSnapshots.map((snapshot) => snapshot.sourceId), authorization));
    const entityIds = new Set([entityId]);
    relations.forEach((relation) => {
      entityIds.add(relation.fromEntityId);
      entityIds.add(relation.toEntityId);
    });
    const entities = [...entityIds]
      .map((id) => this.getEntity(id, authorization))
      .filter((entity): entity is KnowledgeEntity => entity !== null);
    return { entities, relations: relations.map(clone) };
  }

  removeSource(sourceId: string): { entities: number; relations: number } {
    let entities = 0;
    let relations = 0;
    for (const [id, entity] of this.#entities) {
      if (entity.sourceSnapshots.some((snapshot) => snapshot.sourceId === sourceId)) {
        this.#entities.delete(id);
        entities += 1;
      }
    }
    for (const [id, relation] of this.#relations) {
      if (
        relation.sourceSnapshots.some((snapshot) => snapshot.sourceId === sourceId)
        || !this.#entities.has(relation.fromEntityId)
        || !this.#entities.has(relation.toEntityId)
      ) {
        this.#relations.delete(id);
        relations += 1;
      }
    }
    return { entities, relations };
  }
}

export class LocalPolicyAwareCache implements PolicyAwareCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.#now = options.now ?? (() => new Date());
  }

  set<Value>(entry: CacheEntry<Value>): void {
    if (entry.expiresAt) assertTimestamp(entry.expiresAt, 'cache expiresAt');
    this.#entries.set(cacheKey(entry.identity), clone(entry));
  }

  get<Value>(identity: CacheIdentity): CacheEntry<Value> | null {
    const key = cacheKey(identity);
    const entry = this.#entries.get(key);
    if (!entry) return null;
    if (isExpired(entry.expiresAt, this.#now())) {
      this.#entries.delete(key);
      return null;
    }
    return clone(entry) as CacheEntry<Value>;
  }

  invalidateSource(sourceId: string, currentRevision?: string): number {
    let removed = 0;
    for (const [key, entry] of this.#entries) {
      const revision = entry.identity.sourceRevisions?.[sourceId];
      if (revision !== undefined && (currentRevision === undefined || revision !== currentRevision)) {
        this.#entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clearNamespace(namespace: string): number {
    let removed = 0;
    for (const [key, entry] of this.#entries) {
      if (entry.identity.namespace === namespace) {
        this.#entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  size(): number {
    return this.#entries.size;
  }
}

export function estimateInferenceUsage(input: EstimateInferenceUsageInput): UsageMeasurement {
  for (const [name, value] of Object.entries({
    inputTokens: input.inputTokens,
    cachedInputTokens: input.cachedInputTokens ?? 0,
    outputTokens: input.outputTokens,
    reasoningTokens: input.reasoningTokens ?? 0,
    toolCalls: input.toolCalls ?? 0,
    latencyMs: input.latencyMs ?? 0,
  })) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number.`);
  }
  const cachedInputTokens = input.cachedInputTokens ?? 0;
  if (cachedInputTokens > input.inputTokens) throw new Error('cachedInputTokens cannot exceed inputTokens.');
  const pricing = input.target.pricing;
  const inputRate = pricing?.inputPerMillionTokens;
  const cachedRate = pricing?.cachedInputPerMillionTokens ?? inputRate;
  const outputRate = pricing?.outputPerMillionTokens;
  const canPrice = pricing
    && (input.inputTokens - cachedInputTokens === 0 || inputRate !== undefined)
    && (cachedInputTokens === 0 || cachedRate !== undefined)
    && (input.outputTokens === 0 || outputRate !== undefined);
  const cost = canPrice
    ? ((input.inputTokens - cachedInputTokens) * (inputRate ?? 0)
      + cachedInputTokens * (cachedRate ?? 0)
      + input.outputTokens * (outputRate ?? 0)) / 1_000_000
    : undefined;

  return {
    schemaVersion: 1,
    measuredAt: input.measuredAt ?? new Date().toISOString(),
    provider: input.target.provider,
    model: input.target.model,
    inputTokens: input.inputTokens,
    cachedInputTokens,
    outputTokens: input.outputTokens,
    reasoningTokens: input.reasoningTokens ?? 0,
    toolCalls: input.toolCalls ?? 0,
    latencyMs: input.latencyMs ?? 0,
    ...(cost === undefined ? {} : { cost, currency: pricing?.currency }),
    status: cost === undefined ? 'unknown' : 'estimated',
  };
}

export function createUsageLedger(): UsageLedger {
  const records: UsageMeasurement[] = [];
  return {
    record(measurement) {
      records.push(clone(measurement));
    },
    measurements() {
      return records.map(clone);
    },
    summary() {
      return summarizeUsage(records);
    },
    evaluate(budget) {
      const summary = summarizeUsage(records);
      const violations: BudgetEvaluation['violations'] = [];
      if (summary.inputTokens > budget.maxInputTokens) violations.push('input_tokens');
      if (budget.maxOutputTokens !== undefined && summary.outputTokens > budget.maxOutputTokens) {
        violations.push('output_tokens');
      }
      if (budget.maxToolCalls !== undefined && summary.toolCalls > budget.maxToolCalls) {
        violations.push('tool_calls');
      }
      if (budget.maxLatencyMs !== undefined && summary.latencyMs > budget.maxLatencyMs) {
        violations.push('latency');
      }
      if (summary.currencies.length > 1) violations.push('currency');
      if (budget.maxCost !== undefined && summary.cost > budget.maxCost) violations.push('cost');
      return { allowed: violations.length === 0, violations, summary, budget };
    },
  };
}

export function chunkDocument(
  document: IngestionDocument,
  options: Required<ChunkingOptions> = { maxCharacters: 1_200, overlapCharacters: 120 },
): IngestionChunk[] {
  const chunks: IngestionChunk[] = [];
  let startOffset = 0;
  while (startOffset < document.content.length) {
    let endOffset = Math.min(document.content.length, startOffset + options.maxCharacters);
    if (endOffset < document.content.length) {
      const newline = document.content.lastIndexOf('\n', endOffset);
      if (newline > startOffset + Math.floor(options.maxCharacters / 2)) endOffset = newline + 1;
    }
    const content = document.content.slice(startOffset, endOffset);
    const index = chunks.length;
    chunks.push({
      chunkId: `chunk:${hash(`${document.documentId}\0${document.sourceSnapshot.revision}\0${index}\0${content}`)}`,
      documentId: document.documentId,
      sourceSnapshot: clone(document.sourceSnapshot),
      content,
      index,
      startOffset,
      endOffset,
      ...(document.title ? { title: document.title } : {}),
      ...(document.classification ? { classification: document.classification } : {}),
      ...(document.metadata ? { metadata: clone(document.metadata) } : {}),
      ...(document.embedding ? { embedding: [...document.embedding] } : {}),
    });
    if (endOffset === document.content.length) break;
    startOffset = Math.max(startOffset + 1, endOffset - options.overlapCharacters);
  }
  return chunks;
}

function validateRetrievalQuery(query: RetrievalQuery): void {
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit <= 0)) {
    throw new Error('Retrieval limit must be a positive integer.');
  }
  if ((query.mode === 'exact' || query.mode === 'full_text') && !query.text?.trim()) {
    throw new Error(`${query.mode} retrieval requires text.`);
  }
  if (query.mode === 'vector' && !query.embedding) throw new Error('Vector retrieval requires an embedding.');
  if (query.mode === 'hybrid' && (!query.text?.trim() || !query.embedding)) {
    throw new Error('Hybrid retrieval requires text and an embedding.');
  }
}

function lexicalMatch(content: string, text: string, terms: string[], mode: RetrievalQuery['mode']): number {
  if (mode === 'vector') return 0;
  if (mode === 'exact') return content.toLowerCase().includes(text) ? 1 : 0;
  return termCoverage(content, terms);
}

function termCoverage(content: string, terms: string[]): number {
  if (terms.length === 0) return 1;
  const haystack = new Set(tokenize(content));
  return terms.filter((term) => haystack.has(term)).length / terms.length;
}

function combinedScore(mode: RetrievalQuery['mode'], lexical: number, vector?: number): number {
  if (mode === 'vector') return Math.max(0, vector ?? 0);
  if (mode === 'hybrid') return 0.6 * lexical + 0.4 * Math.max(0, vector ?? 0);
  return lexical;
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue ** 2;
    rightNorm += rightValue ** 2;
  }
  return leftNorm === 0 || rightNorm === 0 ? 0 : dot / Math.sqrt(leftNorm * rightNorm);
}

function matchesFilters(chunk: IngestionChunk, filters: Record<string, unknown> | undefined): boolean {
  if (!filters) return true;
  const values: Record<string, unknown> = {
    documentId: chunk.documentId,
    sourceId: chunk.sourceSnapshot.sourceId,
    sourceRevision: chunk.sourceSnapshot.revision,
    classification: chunk.classification,
    title: chunk.title,
    ...chunk.metadata,
  };
  return Object.entries(filters).every(([key, value]) => stableStringify(values[key]) === stableStringify(value));
}

function authorized(sourceIds: string[] | undefined, plan: RetrievalAuthorizationPlan): boolean {
  return plan.decision === 'allow'
    && (sourceIds ?? []).every((sourceId) => plan.allowedSourceIds.includes(sourceId));
}

function summarizeUsage(records: UsageMeasurement[]): UsageSummary {
  const currencies = [...new Set(records.map((record) => record.currency).filter((value): value is string => Boolean(value)))].sort();
  return {
    inputTokens: sum(records, 'inputTokens'),
    cachedInputTokens: sum(records, 'cachedInputTokens'),
    outputTokens: sum(records, 'outputTokens'),
    reasoningTokens: sum(records, 'reasoningTokens'),
    toolCalls: sum(records, 'toolCalls'),
    latencyMs: sum(records, 'latencyMs'),
    cost: sum(records, 'cost'),
    measuredCount: records.filter((record) => record.status === 'measured').length,
    estimatedCount: records.filter((record) => record.status === 'estimated').length,
    unknownCount: records.filter((record) => record.status === 'unknown').length,
    currencies,
  };
}

function sum(records: UsageMeasurement[], key: keyof UsageMeasurement): number {
  return records.reduce((total, record) => {
    const value = record[key];
    return total + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  }, 0);
}

function cacheKey(identity: CacheIdentity): string {
  return hash(stableStringify(identity));
}

function tokenize(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [])];
}

function isExpired(expiresAt: string | undefined, now: Date): boolean {
  return expiresAt !== undefined && Date.parse(expiresAt) <= now.getTime();
}

function assertTimestamp(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} must be an ISO-compatible timestamp.`);
}

function assertConfidence(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Knowledge confidence must be between 0 and 1.');
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => [key, sortValue(nested)]));
}

function clone<Value>(value: Value): Value {
  return structuredClone(value);
}
