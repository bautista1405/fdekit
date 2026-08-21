import { describe, expect, it } from 'vitest';
import type {
  InferenceTarget,
  ProvenanceRecord,
  RetrievalAuthorizationPlan,
  SourceSnapshot,
} from '@fdekit/core';
import {
  LocalKnowledgeStore,
  LocalMemoryStore,
  LocalPolicyAwareCache,
  LocalRetrievalIndex,
  createUsageLedger,
  estimateInferenceUsage,
} from '../intelligence/index.js';

describe('local intelligence primitives', () => {
  it('chunks source snapshots deterministically and never returns unauthorized sources', () => {
    const index = new LocalRetrievalIndex({ maxCharacters: 64, overlapCharacters: 8 });
    const firstSnapshot = snapshot('repo-a', 'commit-1');
    const secondSnapshot = snapshot('repo-b', 'commit-2');
    index.replaceSource(firstSnapshot, [{
      documentId: 'auth-module',
      sourceSnapshot: firstSnapshot,
      title: 'Authorization module',
      content: 'Authorization checks the source permission before retrieval.\n'.repeat(3),
      metadata: { language: 'typescript' },
    }]);
    index.replaceSource(secondSnapshot, [{
      documentId: 'secret-module',
      sourceSnapshot: secondSnapshot,
      content: 'Authorization bypass secret content',
      metadata: { language: 'typescript' },
    }]);

    const results = index.search({
      mode: 'full_text',
      text: 'authorization source permission',
      filters: { language: 'typescript' },
    }, authorization(['repo-a']));

    expect(results.length).toBeGreaterThan(1);
    expect(results.every((result) => result.chunk.sourceSnapshot.sourceId === 'repo-a')).toBe(true);
    expect(new Set(results.map((result) => result.chunk.chunkId)).size).toBe(results.length);
    expect(JSON.stringify(results)).not.toContain('bypass secret');

    const replacement = snapshot('repo-a', 'commit-3');
    index.replaceSource(replacement, [{
      documentId: 'auth-module',
      sourceSnapshot: replacement,
      content: 'Replacement revision with policy enforcement',
    }]);
    const replaced = index.search({ mode: 'exact', text: 'Replacement revision' }, authorization(['repo-a']));
    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.chunk.sourceSnapshot.revision).toBe('commit-3');
  });

  it('supports caller-supplied vector and hybrid search without hidden model calls', () => {
    const index = new LocalRetrievalIndex();
    const source = snapshot('repo-a', 'commit-1');
    index.replaceSource(source, [
      { documentId: 'security', sourceSnapshot: source, content: 'permission policy gate', embedding: [1, 0] },
      { documentId: 'billing', sourceSnapshot: source, content: 'invoice payment total', embedding: [0, 1] },
    ]);

    expect(index.search({ mode: 'vector', embedding: [0.9, 0.1], limit: 1 }, authorization(['repo-a']))[0]
      ?.chunk.documentId).toBe('security');
    expect(index.search({
      mode: 'hybrid',
      text: 'invoice payment',
      embedding: [0, 1],
      limit: 1,
    }, authorization(['repo-a']))[0]?.chunk.documentId).toBe('billing');
  });

  it('keeps working and episodic memory scoped, expiring, and source-authorized', () => {
    const memory = new LocalMemoryStore({ now: () => new Date('2026-08-19T13:00:00.000Z') });
    memory.put({
      id: 'working-1',
      kind: 'working',
      scope: 'session',
      scopeId: 'run-1',
      content: 'Current review cursor is file two',
      createdAt: '2026-08-19T12:00:00.000Z',
    });
    memory.put({
      id: 'episode-1',
      kind: 'episodic',
      scope: 'session',
      scopeId: 'run-1',
      content: 'Reviewer rejected an ungrounded finding',
      sourceIds: ['repo-a'],
      createdAt: '2026-08-19T12:10:00.000Z',
    });
    memory.put({
      id: 'expired',
      kind: 'working',
      scope: 'session',
      scopeId: 'run-1',
      content: 'Old cursor',
      createdAt: '2026-08-19T10:00:00.000Z',
      expiresAt: '2026-08-19T12:30:00.000Z',
    });

    expect(memory.query({ scope: 'session', scopeId: 'run-1' }, authorization(['repo-a'])).map((item) => item.id))
      .toEqual(['episode-1', 'working-1']);
    expect(memory.get('episode-1', authorization([]))).toBeNull();
    expect(memory.query({ scope: 'session', scopeId: 'run-1', kind: 'working' }, authorization(['repo-a'])))
      .toEqual([expect.objectContaining({ id: 'working-1' })]);
  });

  it('stores provenance-aware entities separately from memory and filters graph neighborhoods', () => {
    const knowledge = new LocalKnowledgeStore();
    const source = snapshot('repo-a', 'commit-1');
    const provenance = [provenanceRecord('prov-1', source)];
    knowledge.putEntity({
      id: 'service-api',
      type: 'service',
      name: 'API',
      sourceSnapshots: [source],
      provenance,
      confidence: 1,
      confirmation: 'observed',
      updatedAt: '2026-08-19T12:00:00.000Z',
    });
    knowledge.putEntity({
      id: 'database-main',
      type: 'database',
      name: 'Main database',
      sourceSnapshots: [source],
      provenance,
      confidence: 0.7,
      confirmation: 'inferred',
      updatedAt: '2026-08-19T12:00:00.000Z',
    });
    knowledge.putRelation({
      id: 'api-uses-db',
      type: 'uses',
      fromEntityId: 'service-api',
      toEntityId: 'database-main',
      sourceSnapshots: [source],
      provenance,
      confidence: 0.7,
      confirmation: 'inferred',
      updatedAt: '2026-08-19T12:00:00.000Z',
    });

    expect(knowledge.neighbors('service-api', authorization(['repo-a']))).toMatchObject({
      entities: [expect.any(Object), expect.any(Object)],
      relations: [expect.objectContaining({ id: 'api-uses-db', confirmation: 'inferred' })],
    });
    expect(knowledge.neighbors('service-api', authorization([]))).toEqual({ entities: [], relations: [] });
    expect(knowledge.removeSource('repo-a')).toEqual({ entities: 2, relations: 1 });
  });

  it('partitions caches by tenant, policy, target, and source revision', () => {
    const cache = new LocalPolicyAwareCache({ now: () => new Date('2026-08-19T12:00:00.000Z') });
    const identity = {
      namespace: 'retrieval',
      key: 'permission query',
      tenantFingerprint: 'tenant-a',
      policyFingerprint: 'policy-a',
      targetFingerprint: 'target-a',
      sourceRevisions: { 'repo-a': 'commit-1' },
    };
    cache.set({ identity, value: ['chunk-1'], createdAt: '2026-08-19T11:00:00.000Z' });

    expect(cache.get<string[]>(identity)?.value).toEqual(['chunk-1']);
    expect(cache.get({ ...identity, tenantFingerprint: 'tenant-b' })).toBeNull();
    expect(cache.get({ ...identity, policyFingerprint: 'policy-b' })).toBeNull();
    expect(cache.invalidateSource('repo-a', 'commit-1')).toBe(0);
    expect(cache.invalidateSource('repo-a', 'commit-2')).toBe(1);
    expect(cache.size()).toBe(0);
  });

  it('estimates priced usage explicitly and evaluates actual/unknown ledger data', () => {
    const target = inferenceTarget();
    const estimated = estimateInferenceUsage({
      target,
      inputTokens: 1_000,
      cachedInputTokens: 200,
      outputTokens: 10,
      toolCalls: 2,
      latencyMs: 500,
      measuredAt: '2026-08-19T12:00:00.000Z',
    });
    expect(estimated).toMatchObject({ status: 'estimated', cost: 0.00183, currency: 'USD' });

    const ledger = createUsageLedger();
    ledger.record(estimated);
    ledger.record({ schemaVersion: 1, measuredAt: '2026-08-19T12:01:00.000Z', status: 'unknown' });
    expect(ledger.summary()).toMatchObject({ estimatedCount: 1, unknownCount: 1, toolCalls: 2 });
    expect(ledger.evaluate({ maxInputTokens: 900, maxToolCalls: 1, maxCost: 0.001 })).toMatchObject({
      allowed: false,
      violations: ['input_tokens', 'tool_calls', 'cost'],
    });

    expect(estimateInferenceUsage({
      target: { ...target, pricing: undefined },
      inputTokens: 10,
      outputTokens: 2,
    }).status).toBe('unknown');
  });
});

function snapshot(sourceId: string, revision: string): SourceSnapshot {
  return { sourceId, revision, observedAt: '2026-08-19T12:00:00.000Z' };
}

function authorization(sourceIds: string[]): RetrievalAuthorizationPlan {
  return {
    schemaVersion: 1,
    policyFingerprint: 'policy-a',
    decision: 'allow',
    createdAt: '2026-08-19T12:00:00.000Z',
    allowedSourceIds: sourceIds,
    deniedSources: [],
  };
}

function provenanceRecord(id: string, sourceSnapshot: SourceSnapshot): ProvenanceRecord {
  return {
    schemaVersion: 1,
    id,
    source: sourceSnapshot.sourceId,
    sourceSnapshot,
    recordedAt: '2026-08-19T12:00:00.000Z',
    confirmation: 'observed',
  };
}

function inferenceTarget(): InferenceTarget {
  return {
    id: 'priced-target',
    provider: 'provider-a',
    model: 'model-a',
    capabilities: {
      inputModalities: ['text'],
      outputModalities: ['text'],
      contextWindowTokens: 128_000,
      maxOutputTokens: 4_000,
      toolCalls: true,
      structuredOutput: true,
      streaming: true,
      reasoning: false,
      promptCaching: true,
    },
    pricing: {
      currency: 'USD',
      inputPerMillionTokens: 2,
      cachedInputPerMillionTokens: 1,
      outputPerMillionTokens: 3,
    },
  };
}
