import { asArray, asRecord, getString } from '@fdekit/core';

export function createSalesResearchMockPlanner() {
  return function salesResearchMockPlanner(context) {
  const accountId = getString(context.input.accountId);
  const domain = getString(context.input.domain);
  const companyName = getString(context.input.companyName);
  const persona = getString(context.input.persona) ?? 'economic buyer';

  if (!accountId && !domain && !companyName) {
    return {
      type: 'final',
      message: 'No account was provided. Pass accountId, domain, or companyName to run sales research.',
    };
  }

  const accountCall = findToolResult(context.toolResults, 'sales.account.lookup');

  if (!accountCall) {
    return {
      type: 'tool_call',
      toolName: 'sales.account.lookup',
      args: { accountId, domain, companyName },
      reason: 'Load account context before building a sales research plan.',
    };
  }

  const account = asRecord(accountCall.result);
  const resolvedAccountId = getString(account.id) ?? accountId;

  if (!resolvedAccountId) {
    return {
      type: 'final',
      message: `No account matched ${companyName ?? domain ?? accountId}.`,
    };
  }

  const contactsCall = findToolResult(context.toolResults, 'sales.contacts.find');

  if (!contactsCall) {
    return {
      type: 'tool_call',
      toolName: 'sales.contacts.find',
      args: {
        accountId: resolvedAccountId,
        persona,
      },
      reason: 'Find relevant buyer and champion contacts.',
    };
  }

  const intentCall = findToolResult(context.toolResults, 'sales.intent.lookup');

  if (!intentCall) {
    return {
      type: 'tool_call',
      toolName: 'sales.intent.lookup',
      args: {
        accountId: resolvedAccountId,
      },
      reason: 'Gather buying signals and account timing.',
    };
  }

  const contacts = asArray(asRecord(contactsCall.result).contacts).map(asRecord);
  const signals = asArray(asRecord(intentCall.result).signals).map(asRecord);
  const primaryContact = contacts[0];
  const signalSummary = signals
    .map((signal) => getString(signal.summary))
    .filter(Boolean)
    .slice(0, 3);
  const accountName = getString(account.name) ?? companyName ?? domain ?? resolvedAccountId;
  const recommendedAngle = getString(account.recommendedAngle)
    ?? signalSummary[0]
    ?? 'lead with a customer-specific operational efficiency angle';

  if (hasAvailableTool(context, 'crm.note.create') && !findToolResult(context.toolResults, 'crm.note.create')) {
    return {
      type: 'tool_call',
      toolName: 'crm.note.create',
      args: {
        accountId: resolvedAccountId,
        title: `Sales research brief for ${accountName}`,
        summary: [
          `Account: ${accountName}`,
          `Segment: ${getString(account.segment) ?? 'unknown'}`,
          `Recommended angle: ${recommendedAngle}`,
          `Signals: ${signalSummary.join('; ') || 'No strong public buying signals found.'}`,
          `Primary contact: ${getString(primaryContact.name) ?? 'No contact found'} (${getString(primaryContact.title) ?? 'unknown title'})`,
        ].join('\n'),
        nextStep: `Send a concise opener to ${getString(primaryContact.name) ?? 'the account team'} about ${recommendedAngle}.`,
      },
      reason: 'Write the research brief back to the CRM workspace.',
    };
  }

  return {
    type: 'final',
    message: `${accountName} sales research is ready. Lead with ${recommendedAngle}. Primary contact: ${getString(primaryContact.name) ?? 'no contact found'}. Next step: send a tailored opener and log the CRM note.`,
    metadata: {
      accountId: resolvedAccountId,
      accountName,
      recommendedAngle,
      contacts: contacts.length,
      signals: signalSummary,
    },
  };
};

function findToolResult(toolResults, toolName) {
  return toolResults.find((result) => result.name === toolName);
}

function hasAvailableTool(context, toolName) {
  const connectorTools = Object.values(context.deployment.connectors ?? {})
    .flatMap((connector) => connector.tools ?? []);
  const agentTools = context.agent.tools ?? [];

  return [...connectorTools, ...agentTools].some((tool) => tool.name === toolName);
}
}
