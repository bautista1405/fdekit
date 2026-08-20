import type {
  ContextExclusionReason,
  ContextObjectives,
  ContextPlannerCandidate,
  ContextSelectionEntry,
  EffectivePolicy,
  EvidenceItem,
  InferenceRequirements,
  InferenceRouteCandidate,
  InferenceTargetSelection,
  MemoryItem,
  RetrievalAuthorizationDenial,
  RetrievalAuthorizationPlan,
  SkillPlannerCandidate,
  StepContextPlan,
  ToolPlannerCandidate,
} from '@fdekit/core';

export interface AuthorizeRetrievalInput {
  policy: EffectivePolicy;
  requestedSourceIds: string[];
  evaluatedAt?: string;
}

export interface PlanStepContextInput {
  identity?: StepContextPlan['identity'];
  target: StepContextPlan['target'];
  endpoint: StepContextPlan['endpoint'];
  policy: EffectivePolicy;
  authorization: RetrievalAuthorizationPlan;
  budget: StepContextPlan['budget'];
  objectives: ContextObjectives;
  items?: ContextPlannerCandidate[];
  skills?: SkillPlannerCandidate[];
  tools?: ToolPlannerCandidate[];
}

export function authorizeRetrieval(input: AuthorizeRetrievalInput): RetrievalAuthorizationPlan {
  const sourceIds = [...new Set(input.requestedSourceIds.map((id) => id.trim()).filter(Boolean))].sort();
  const deniedSources: RetrievalAuthorizationDenial[] = [];
  const allowedSourceIds: string[] = [];
  const sourceAllowlist = input.policy.sourceAllowlist;
  const readCapability = input.policy.capabilities.includes('source:read');
  const readNeedsApproval = input.policy.approvalRequiredFor.includes('source:read');

  for (const sourceId of sourceIds) {
    if (input.policy.decision === 'deny') {
      deniedSources.push({ sourceId, reason: 'policy_denied' });
    } else if (!readCapability) {
      deniedSources.push({ sourceId, reason: 'capability_missing' });
    } else if (sourceAllowlist && !sourceAllowlist.includes(sourceId)) {
      deniedSources.push({ sourceId, reason: 'source_not_allowed' });
    } else if (readNeedsApproval) {
      deniedSources.push({ sourceId, reason: 'approval_required' });
    } else {
      allowedSourceIds.push(sourceId);
    }
  }

  const decision = deniedSources.some((entry) => entry.reason !== 'approval_required')
    ? 'deny'
    : deniedSources.some((entry) => entry.reason === 'approval_required')
      ? 'needs_approval'
      : 'allow';

  return {
    schemaVersion: 1,
    policyFingerprint: input.policy.fingerprint,
    decision,
    createdAt: input.evaluatedAt ?? new Date().toISOString(),
    allowedSourceIds,
    deniedSources,
  };
}

export function selectInferenceTarget(
  routes: InferenceRouteCandidate[],
  requirements: InferenceRequirements = {},
): InferenceTargetSelection {
  const rejected: InferenceTargetSelection['rejected'] = [];
  const viable = routes.flatMap((route) => {
    const reasons = routeRejectionReasons(route, requirements);
    if (reasons.length > 0) {
      rejected.push({
        targetId: route.target.id,
        endpointId: route.endpoint.id,
        reasons,
      });
      return [];
    }
    return [route];
  }).sort((left, right) =>
    (left.priority ?? 0) - (right.priority ?? 0)
      || left.target.id.localeCompare(right.target.id)
      || left.endpoint.id.localeCompare(right.endpoint.id));
  const selected = viable[0];

  return selected
    ? { status: 'selected', target: selected.target, endpoint: selected.endpoint, rejected }
    : { status: 'unavailable', rejected };
}

export function planStepContext(input: PlanStepContextInput): StepContextPlan {
  if (input.endpoint.provider !== input.target.provider) {
    throw new Error(
      `Inference endpoint ${input.endpoint.id} serves ${input.endpoint.provider}, not ${input.target.provider}.`,
    );
  }

  const reservedTokens = input.budget.reservedTokens ?? 0;
  const requestedOutputTokens = input.budget.maxOutputTokens ?? input.target.capabilities.maxOutputTokens;
  const targetInputLimit = Math.max(
    0,
    input.target.capabilities.contextWindowTokens - requestedOutputTokens,
  );
  const inputTokenLimit = Math.max(
    0,
    Math.min(input.budget.maxInputTokens, targetInputLimit) - reservedTokens,
  );
  const feasibilityReasons: string[] = [];
  let feasibility: StepContextPlan['feasibility']['status'] = 'feasible';

  if (input.authorization.policyFingerprint !== input.policy.fingerprint) {
    feasibility = 'blocked';
    feasibilityReasons.push('Retrieval authorization was evaluated against a different effective policy.');
  } else if (input.authorization.decision === 'needs_approval') {
    feasibility = 'needs_approval';
    feasibilityReasons.push('One or more requested sources require approval before retrieval.');
  } else if (input.authorization.decision === 'deny' || input.policy.decision === 'deny') {
    feasibility = 'blocked';
    feasibilityReasons.push('Effective policy denied one or more requested sources or the execution itself.');
  }

  const selected: ContextSelectionEntry[] = [];
  const excluded: ContextSelectionEntry[] = [];
  const selectedItems: ContextPlannerCandidate[] = [];
  const selectedSkills: SkillPlannerCandidate[] = [];
  const selectedTools: ToolPlannerCandidate[] = [];
  let estimatedInputTokens = 0;
  let retrievalItems = 0;
  let toolCount = 0;

  const candidates = normalizeCandidates(input);

  for (const candidate of candidates) {
    const sourceIds = candidate.sourceIds ?? [];
    const sourceAuthorized = sourceIds.every((id) => input.authorization.allowedSourceIds.includes(id));
    let exclusion: ContextExclusionReason | undefined;

    if (feasibility !== 'feasible') {
      exclusion = input.authorization.decision === 'needs_approval'
        ? 'approval_required'
        : 'policy_denied';
    } else if (!sourceAuthorized) {
      exclusion = 'source_not_authorized';
    } else if (
      candidate.category === 'item'
      && isRetrievalItem(candidate.value.item.kind)
      && input.budget.maxRetrievalItems !== undefined
      && retrievalItems >= input.budget.maxRetrievalItems
    ) {
      exclusion = 'retrieval_limit';
    } else if (
      candidate.category === 'tool'
      && input.budget.maxToolCalls !== undefined
      && toolCount >= input.budget.maxToolCalls
    ) {
      exclusion = 'tool_limit';
    } else if (estimatedInputTokens + candidate.estimatedTokens > inputTokenLimit) {
      exclusion = 'token_budget';
    }

    const entry: ContextSelectionEntry = {
      id: candidate.id,
      kind: candidate.kind,
      estimatedTokens: candidate.estimatedTokens,
      required: candidate.required,
      decision: exclusion ? 'excluded' : 'selected',
      reason: exclusion ?? (candidate.required ? 'required' : 'ranked'),
      ...(sourceIds.length > 0 ? { sourceIds } : {}),
    };

    if (exclusion) {
      excluded.push(entry);
      if (candidate.required && feasibility === 'feasible') {
        feasibility = exclusion === 'approval_required' ? 'needs_approval' : 'blocked';
        feasibilityReasons.push(`Required ${candidate.kind} ${candidate.id} was excluded: ${exclusion}.`);
      }
      continue;
    }

    selected.push(entry);
    estimatedInputTokens += candidate.estimatedTokens;
    if (candidate.category === 'item') {
      selectedItems.push(candidate.value);
      if (isRetrievalItem(candidate.value.item.kind)) retrievalItems += 1;
    } else if (candidate.category === 'skill') {
      selectedSkills.push(candidate.value);
    } else {
      selectedTools.push(candidate.value);
      toolCount += 1;
    }
  }

  return {
    schemaVersion: 1,
    ...(input.identity ? { identity: input.identity } : {}),
    target: input.target,
    endpoint: input.endpoint,
    budget: input.budget,
    objectives: input.objectives,
    inputTokenLimit,
    estimatedInputTokens,
    feasibility: { status: feasibility, reasons: feasibilityReasons },
    model: {
      schemaVersion: 1,
      instructions: selectedItems
        .filter((candidate) => candidate.item.kind === 'instruction')
        .map((candidate) => candidate.item),
      evidence: selectedItems
        .filter((candidate) => candidate.item.kind === 'evidence')
        .map((candidate) => candidate.item as EvidenceItem),
      memory: selectedItems
        .filter((candidate) => candidate.item.kind === 'memory')
        .map((candidate) => candidate.item as MemoryItem),
      skills: selectedSkills.map((candidate) => candidate.skill),
      tools: selectedTools.map((candidate) => candidate.tool),
      recentActions: selectedItems
        .filter((candidate) => candidate.item.kind === 'recent_action')
        .map((candidate) => candidate.item as StepContextPlan['model']['recentActions'][number]),
    },
    manifest: { schemaVersion: 1, selected, excluded },
  };
}

function routeRejectionReasons(
  route: InferenceRouteCandidate,
  requirements: InferenceRequirements,
): string[] {
  const reasons: string[] = [];
  const capabilities = route.target.capabilities;

  if (route.enabled === false) reasons.push('route_disabled');
  if (route.endpoint.provider !== route.target.provider) reasons.push('provider_endpoint_mismatch');
  if (requirements.allowedProviders && !requirements.allowedProviders.includes(route.target.provider)) {
    reasons.push('provider_not_allowed');
  }
  if (
    requirements.allowedRegions
    && (!route.endpoint.region || !requirements.allowedRegions.includes(route.endpoint.region))
  ) {
    reasons.push('region_not_allowed');
  }
  if ((requirements.minimumContextTokens ?? 0) > capabilities.contextWindowTokens) {
    reasons.push('context_window_too_small');
  }
  if ((requirements.minimumOutputTokens ?? 0) > capabilities.maxOutputTokens) {
    reasons.push('output_limit_too_small');
  }
  for (const modality of requirements.inputModalities ?? []) {
    if (!capabilities.inputModalities.includes(modality)) reasons.push(`input_modality_missing:${modality}`);
  }
  for (const modality of requirements.outputModalities ?? []) {
    if (!capabilities.outputModalities.includes(modality)) reasons.push(`output_modality_missing:${modality}`);
  }
  for (const key of ['toolCalls', 'structuredOutput', 'streaming', 'reasoning', 'promptCaching'] as const) {
    if (requirements[key] && !capabilities[key]) reasons.push(`capability_missing:${key}`);
  }

  return reasons;
}

type NormalizedCandidate =
  | NormalizedItemCandidate
  | NormalizedSkillCandidate
  | NormalizedToolCandidate;

interface NormalizedCandidateBase {
  id: string;
  kind: ContextSelectionEntry['kind'];
  estimatedTokens: number;
  required: boolean;
  priority: number;
  score: number;
  sourceIds?: string[];
}

interface NormalizedItemCandidate extends NormalizedCandidateBase {
  category: 'item';
  value: ContextPlannerCandidate;
}

interface NormalizedSkillCandidate extends NormalizedCandidateBase {
  category: 'skill';
  kind: 'skill';
  value: SkillPlannerCandidate;
}

interface NormalizedToolCandidate extends NormalizedCandidateBase {
  category: 'tool';
  kind: 'tool';
  value: ToolPlannerCandidate;
}

function normalizeCandidates(input: PlanStepContextInput): NormalizedCandidate[] {
  const items: NormalizedItemCandidate[] = (input.items ?? []).map((candidate) => {
    assertTokenEstimate(candidate.estimatedTokens, candidate.item.id);
    const sourceIds = [...new Set(candidate.sourceIds ?? candidate.item.sourceIds ?? [])].sort();
    return {
      category: 'item',
      id: candidate.item.id,
      kind: candidate.item.kind,
      estimatedTokens: candidate.estimatedTokens,
      required: candidate.required ?? false,
      priority: candidate.priority ?? 0,
      score: objectiveScore(candidate.scores, input.objectives),
      ...(sourceIds.length > 0 ? { sourceIds } : {}),
      value: candidate,
    };
  });
  const skills: NormalizedSkillCandidate[] = (input.skills ?? []).map((candidate) => {
    const id = `${candidate.skill.name}@${candidate.skill.version}`;
    assertTokenEstimate(candidate.estimatedTokens, id);
    return {
      category: 'skill',
      id,
      kind: 'skill',
      estimatedTokens: candidate.estimatedTokens,
      required: candidate.required ?? false,
      priority: candidate.priority ?? 0,
      score: 0,
      value: candidate,
    };
  });
  const tools: NormalizedToolCandidate[] = (input.tools ?? []).map((candidate) => {
    assertTokenEstimate(candidate.estimatedTokens, candidate.tool.name);
    return {
      category: 'tool',
      id: candidate.tool.name,
      kind: 'tool',
      estimatedTokens: candidate.estimatedTokens,
      required: candidate.required ?? false,
      priority: candidate.priority ?? 0,
      score: 0,
      value: candidate,
    };
  });

  return [...items, ...skills, ...tools].sort((left, right) =>
    Number(right.required) - Number(left.required)
      || right.priority - left.priority
      || right.score - left.score
      || left.id.localeCompare(right.id));
}

function objectiveScore(
  scores: Partial<ContextObjectives> | undefined,
  objectives: ContextObjectives,
): number {
  if (!scores) return 0;
  return (Object.keys(objectives) as Array<keyof ContextObjectives>)
    .reduce((total, key) => total + objectives[key] * (scores[key] ?? 0), 0);
}

function assertTokenEstimate(value: number, id: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Context candidate ${id} must have a non-negative integer token estimate.`);
  }
}

function isRetrievalItem(kind: ContextSelectionEntry['kind']): boolean {
  return kind === 'evidence' || kind === 'memory';
}
