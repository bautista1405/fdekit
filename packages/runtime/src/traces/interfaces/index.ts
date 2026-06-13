export interface TraceEvent {
  type: string;
  message?: string;
  [key: string]: unknown;
}

export interface TraceArtifact {
  id: string;
  createdAt: string;
  deployment: string;
  events: TraceEvent[];
}
