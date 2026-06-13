import { createServer } from 'node:http';

const port = Number(process.env.PORT || 8788);

const customer = {
  id: 'cus_1001',
  name: 'company Bank',
  tier: 'enterprise',
};

const ticket = {
  id: 'tick_1001',
  customerId: 'cus_1001',
  title: 'Checkout latency regression',
  priority: 'high',
};

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${port}`);

  setTimeout(() => {
    if (url.pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'load-test-customer-api' });
      return;
    }

    if (url.pathname === '/customers/cus_1001') {
      sendJson(res, 200, customer);
      return;
    }

    if (url.pathname === '/tickets/tick_1001') {
      sendJson(res, 200, ticket);
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  }, 25);
});

server.listen(port, () => {
  console.log(`Load-test customer API listening on http://127.0.0.1:${port}`);
});

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}
