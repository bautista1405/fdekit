import { asRecord, getString } from '@fdekit/core';

export function createSupportTriageMockPlanner() {
  return function supportTriageMockPlanner(context) {
  const ticketId = getString(context.input.ticketId);

  if (!ticketId) {
    return {
      type: 'final',
      message: 'No ticket id was provided. Pass --ticket <id> to run support triage.',
    };
  }

  const ticketCall = findToolResult(context.toolResults, 'ticket.get');

  if (!ticketCall) {
    return {
      type: 'tool_call',
      toolName: 'ticket.get',
      args: { ticketId },
      reason: 'Load the support ticket before deciding triage.',
    };
  }

  const ticket = asRecord(ticketCall.result);
  const embeddedCustomer = asRecord(ticket.customer);
  const customerId = getString(ticket.customerId)
    ?? getString(embeddedCustomer.id)
    ?? getString(context.input.customerId);
  const customerCall = findToolResult(context.toolResults, 'customer.get');

  if (customerId && !customerCall) {
    return {
      type: 'tool_call',
      toolName: 'customer.get',
      args: { customerId },
      reason: 'Load customer and subscription context before deciding escalation.',
    };
  }

  const customer = customerCall ? asRecord(customerCall.result) : embeddedCustomer;
  const triage = classifySupportCase(ticket, customer);

  if (!triage.shouldEscalate) {
    return {
      type: 'final',
      message: `${triage.customerName} ticket ${ticketId} can stay in standard support triage. Reason: ${triage.reason}.`,
      metadata: { triage },
    };
  }

  if (!findToolResult(context.toolResults, 'issue.create')) {
    return {
      type: 'tool_call',
      toolName: 'issue.create',
      reason: 'Create an engineering issue for the escalated support case.',
      args: {
        ticketId,
        title: `[${triage.priority.toUpperCase()}] ${getString(ticket.title) ?? `Support ticket ${ticketId}`}`,
        body: [
          `Customer: ${triage.customerName}`,
          `Reason: ${triage.reason}`,
          `Ticket: ${getString(ticket.body) ?? 'No ticket body provided.'}`,
        ].join('\n'),
        priority: triage.priority,
      },
      metadata: { triage },
    };
  }

  if (!findToolResult(context.toolResults, 'slack.message')) {
    return {
      type: 'tool_call',
      toolName: 'slack.message',
      reason: 'Notify the support escalation channel.',
      args: {
        channel: '#support-escalations',
        ticketId,
        text: `${triage.customerName} needs ${triage.priority}-priority escalation for ${triage.reason}. Ticket: ${ticketId}.`,
      },
      metadata: { triage },
    };
  }

  if (!findToolResult(context.toolResults, 'ticket.escalate')) {
    return {
      type: 'tool_call',
      toolName: 'ticket.escalate',
      reason: 'Move the ticket into the escalation queue.',
      args: {
        ticketId,
        reason: triage.reason,
        channel: '#support-escalations',
      },
      metadata: { triage },
    };
  }

  return {
    type: 'final',
    message: `${triage.customerName} ticket ${ticketId} was escalated as ${triage.priority} priority because ${triage.reason}.`,
    metadata: { triage },
  };
};

function findToolResult(toolResults, toolName) {
  return toolResults.find((result) => result.name === toolName);
}

function classifySupportCase(ticket, customer) {
  const title = getString(ticket.title) ?? '';
  const body = getString(ticket.body) ?? '';
  const priority = getString(ticket.priority) ?? 'normal';
  const tags = Array.isArray(ticket.tags) ? ticket.tags.map((tag) => String(tag).toLowerCase()) : [];
  const tier = getString(customer.tier)?.toLowerCase();
  const text = `${title} ${body} ${tags.join(' ')}`.toLowerCase();
  const isEnterprise = tier === 'enterprise';
  const isRenewal = text.includes('renewal');
  const isBilling = text.includes('billing');
  const isAvailability = text.includes('unavailable') || text.includes('production') || text.includes('outage');
  const shouldEscalate = priority === 'high' || isEnterprise || isRenewal || isBilling || isAvailability;
  const reasons = [
    isEnterprise ? 'enterprise customer' : '',
    isBilling ? 'billing impact' : '',
    isRenewal ? 'renewal risk' : '',
    isAvailability ? 'availability impact' : '',
    priority === 'high' ? 'high-priority ticket' : '',
  ].filter(Boolean);

  return {
    shouldEscalate,
    priority: shouldEscalate ? 'high' : 'normal',
    customerName: getString(customer.name) ?? getString(asRecord(ticket.customer).name) ?? 'Unknown customer',
    reason: reasons.join(', ') || 'standard support request',
  };
}
}
