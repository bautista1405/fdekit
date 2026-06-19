import http from 'k6/http';
import { check, sleep } from 'k6';

const targetUrl = (__ENV.LOAD_TEST_TARGET_URL || __ENV.TARGET_URL || 'http://localhost:8000').replace(/\/+$/, '');
const p95 = Number(__ENV.K6_P95_THRESHOLD_MS || '500');
const errorRate = Number(__ENV.K6_ERROR_RATE_THRESHOLD || '0.01');

export const options = {
  thresholds: {
    http_req_failed: [`rate<${errorRate}`],
    http_req_duration: [`p(95)<${p95}`],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const health = http.get(`${targetUrl}/health`);
  check(health, {
    'health status is 200': (response) => response.status === 200,
  });

  const customer = http.get(`${targetUrl}/customers/cus_1001`);
  check(customer, {
    'customer status is 200': (response) => response.status === 200,
  });

  const ticket = http.get(`${targetUrl}/tickets/tick_1001`);
  check(ticket, {
    'ticket status is 200': (response) => response.status === 200,
  });

  sleep(1);
}

export function handleSummary(data) {
  const summaryPath = __ENV.FDEKIT_K6_SUMMARY_PATH || 'load-tests/.results/latest-summary.json';
  return {
    [summaryPath]: JSON.stringify(data, null, 2),
  };
}
