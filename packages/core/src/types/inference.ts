export type InferenceModality = 'text' | 'image' | 'audio' | 'video' | 'embedding';

export interface InferenceTargetCapabilities {
  inputModalities: InferenceModality[];
  outputModalities: InferenceModality[];
  contextWindowTokens: number;
  maxOutputTokens: number;
  toolCalls: boolean;
  structuredOutput: boolean;
  streaming: boolean;
  reasoning: boolean;
  promptCaching: boolean;
}

/** Provider/model capability identity, with no credentials or endpoint URL. */
export interface InferenceTarget {
  id: string;
  provider: string;
  model: string;
  capabilities: InferenceTargetCapabilities;
  pricing?: {
    currency: string;
    inputPerMillionTokens?: number;
    cachedInputPerMillionTokens?: number;
    outputPerMillionTokens?: number;
  };
  metadata?: Record<string, unknown>;
}

/** Host-only connection identity. credentialRef names a secret; it is never the secret value. */
export interface InferenceEndpointReference {
  id: string;
  provider: string;
  credentialRef?: string;
  region?: string;
  trustBoundary?: string;
  metadata?: Record<string, unknown>;
}

export interface InferenceRouteCandidate {
  target: InferenceTarget;
  endpoint: InferenceEndpointReference;
  priority?: number;
  enabled?: boolean;
}

export interface InferenceRequirements {
  inputModalities?: InferenceModality[];
  outputModalities?: InferenceModality[];
  minimumContextTokens?: number;
  minimumOutputTokens?: number;
  toolCalls?: boolean;
  structuredOutput?: boolean;
  streaming?: boolean;
  reasoning?: boolean;
  promptCaching?: boolean;
  allowedProviders?: string[];
  allowedRegions?: string[];
}

export interface InferenceRouteRejection {
  targetId: string;
  endpointId: string;
  reasons: string[];
}

export interface InferenceTargetSelection {
  status: 'selected' | 'unavailable';
  target?: InferenceTarget;
  endpoint?: InferenceEndpointReference;
  rejected: InferenceRouteRejection[];
}
