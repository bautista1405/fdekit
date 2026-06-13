import type { ConsoleMetrics } from '../../interfaces/index.js';
import {
  collectConnectorEvidence,
  collectCreatedIssues,
  collectRunHistory,
  collectSlackMessages,
  latestTrace,
} from '../traces.js';
import type { MetricsContext } from './context.js';

export type EvidenceMetrics = Pick<
  ConsoleMetrics,
  'createdIssues' | 'slackMessages' | 'connectorEvidence' | 'runHistory' | 'latestTrace'
>;

export function collectEvidenceMetrics(context: MetricsContext): EvidenceMetrics {
  return {
    createdIssues: collectCreatedIssues(context.traces),
    slackMessages: collectSlackMessages(context.traces),
    connectorEvidence: collectConnectorEvidence(context.traces),
    runHistory: collectRunHistory(context.traces),
    latestTrace: latestTrace(context.traces),
  };
}
