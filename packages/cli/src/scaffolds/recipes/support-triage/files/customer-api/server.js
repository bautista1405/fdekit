import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const defaultSeedUrl = new URL('./data/seed.json', import.meta.url);

export async function loadSeed(seedUrl = defaultSeedUrl) {
  return JSON.parse(await readFile(seedUrl, 'utf8'));
}

export async function createCustomerApiServer(options = {}) {
  const state = structuredClone(options.seed ?? await loadSeed());

  return createServer(async (req, res) => {
    try {
      await routeRequest(req, res, state);
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: 'internal_error' });
    }
  });
}

async function routeRequest(req, res, state) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const segments = url.pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'support-triage-customer-api' });
    return;
  }

  if (req.method === 'GET' && segments[0] === 'customers' && segments[1]) {
    const customer = state.customers.find((item) => item.id === segments[1]);
    const subscription = state.subscriptions.find((item) => item.customerId === segments[1]);

    sendMaybeFound(res, customer && { ...customer, subscription });
    return;
  }

  if (req.method === 'GET' && segments[0] === 'tickets' && segments[1]) {
    const ticket = state.tickets.find((item) => item.id === segments[1]);
    const customer = ticket ? state.customers.find((item) => item.id === ticket.customerId) : undefined;

    sendMaybeFound(res, ticket && { ...ticket, customer });
    return;
  }

  if (req.method === 'GET' && segments[0] === 'tickets') {
    const status = url.searchParams.get('status');
    const tickets = status
      ? state.tickets.filter((item) => item.status === status)
      : state.tickets;

    sendJson(res, 200, { tickets });
    return;
  }

  if (req.method === 'POST' && segments[0] === 'tickets' && segments[1] && segments[2] === 'escalate') {
    const ticket = state.tickets.find((item) => item.id === segments[1]);
    if (!ticket) {
      sendJson(res, 404, { error: 'ticket_not_found' });
      return;
    }

    const body = await readJsonBody(req);
    const escalation = {
      id: `esc_${state.escalations.length + 1}`,
      ticketId: ticket.id,
      reason: body.reason ?? 'No reason provided',
      channel: body.channel ?? '#support-escalations',
      createdAt: new Date().toISOString(),
    };

    ticket.status = 'escalated';
    state.escalations.push(escalation);
    sendJson(res, 201, { escalation, ticket });
    return;
  }

  if (req.method === 'POST' && segments[0] === 'issues') {
    const body = await readJsonBody(req);
    const issue = {
      id: `issue_${state.issues.length + 1}`,
      ticketId: body.ticketId,
      title: body.title,
      body: body.body,
      priority: body.priority ?? 'normal',
      createdAt: new Date().toISOString(),
    };

    state.issues.push(issue);
    sendJson(res, 201, { issue });
    return;
  }

  if (req.method === 'POST' && segments[0] === 'slack' && segments[1] === 'messages') {
    const body = await readJsonBody(req);
    const message = {
      id: `msg_${state.messages.length + 1}`,
      channel: body.channel ?? '#support-triage',
      text: body.text,
      ticketId: body.ticketId,
      createdAt: new Date().toISOString(),
    };

    state.messages.push(message);
    sendJson(res, 201, { message });
    return;
  }

  sendJson(res, 404, { error: 'not_found' });
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendMaybeFound(res, value) {
  if (!value) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }

  sendJson(res, 200, value);
}

function sendJson(res, statusCode, value) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  });
  res.end(`${JSON.stringify(value, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '127.0.0.1';
  const server = await createCustomerApiServer();

  server.listen(port, host, () => {
    console.log(`Customer API listening on http://${host}:${port}`);
  });
}
