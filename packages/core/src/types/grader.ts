export interface GraderDefinition {
  name: string;
  /**
   * Provider key from `deployment.providers` used to back the judge; when
   * omitted, the wiring defaults to the reviewed agent's provider.
   */
  provider?: string;
  model?: string;
  /** Rubric shown verbatim to the judge. */
  rubric: string;
  /** Findings scoring below this are suppressed (0..1). */
  threshold: number;
  /** Cap on findings that survive grading, ranked by score. */
  maxFindings?: number;
}
