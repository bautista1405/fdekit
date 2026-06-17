import {
  asRecord,
  createHttpReq,
  defineConnector,
  defineTool,
  environmentEndpointConfigValue,
  isEnvironmentEndpointRef,
  readEnvValue,
  resolveEnvironmentEndpoint,
  type ConnectorDefinition,
  type ToolCallContext,
} from '@fdekit/core';
import { normalizeBaseUrl, requestJson } from './helpers/index.js';
import type { CustomerApiConnectorConfig, CustomerApiConnectorOptions, CustomerApiHealthCheckArgs, CustomerApiHealthCheckResult, CustomerApiMapper, CustomerApiRoutes, EscalateTicketArgs, GetCustomerArgs, GetTicketArgs } from './interfaces/index.js';
export type { CustomerApiConnectorConfig, CustomerApiConnectorOptions, CustomerApiHealthCheckArgs, CustomerApiHealthCheckResult, CustomerApiMapper, CustomerApiRoutes, EscalateTicketArgs, GetCustomerArgs, GetTicketArgs } from './interfaces/index.js';

const healthCheckArgsSchema = {
  type: 'object',
  properties: {},
};

const defaultToolEnvironments = ['local', 'development', 'staging'];

const getCustomerArgsSchema = {
  type: 'object',
  required: ['customerId'],
  properties: {
    customerId: {
      type: 'string',
      description: 'Customer identifier in the customer API',
    },
  },
};

const getTicketArgsSchema = {
  type: 'object',
  required: ['ticketId'],
  properties: {
    ticketId: {
      type: 'string',
      description: 'Support ticket identifier in the customer API',
    },
  },
};

const escalateTicketArgsSchema = {
  type: 'object',
  required: ['ticketId', 'reason'],
  properties: {
    ticketId: {
      type: 'string',
      description: 'Support ticket identifier to escalate',
    },
    reason: {
      type: 'string',
      description: 'Short escalation reason with supporting context',
    },
    channel: {
      type: 'string',
      description: 'Optional escalation channel or queue',
    },
  },
};

export function customerApiConnector<
  RawCustomer = any,
  RawTicket = any,
  RawEscalation = any,
>(
  options: CustomerApiConnectorOptions<RawCustomer, RawTicket, RawEscalation> = {},
): ConnectorDefinition<CustomerApiConnectorConfig> {
  const baseUrlEnv = options.baseUrlEnv ?? 'CUSTOMER_API_URL';
  // Resolved per call so env overrides and environment endpoint refs take
  // effect without re-evaluating the config.
  const resolveBaseUrl = (context?: ToolCallContext) => {
    if (isEnvironmentEndpointRef(options.baseUrl)) {
      const resolved = resolveEnvironmentEndpoint(options.baseUrl, context?.runtimeEnvironment);

      if (!resolved) {
        throw new Error(
          `Customer API base URL references environment endpoint "${options.baseUrl.$environmentEndpoint}", `
          + 'but the deployment runtime environment does not export it; '
          + 'declare it on the environment (for example dockerEnvironment({ customerApi: { url } })) or pass an explicit baseUrl',
        );
      }

      return normalizeBaseUrl(resolved);
    }

    return normalizeBaseUrl(options.baseUrl ?? readEnvValue(baseUrlEnv, options.env) ?? 'http://127.0.0.1:8787');
  };
  const baseUrl = isEnvironmentEndpointRef(options.baseUrl)
    ? environmentEndpointConfigValue(options.baseUrl)
    : resolveBaseUrl();
  const http = createHttpReq(options.resilience);
  const fetchImpl = ((input, init) => http.request(options.fetch ?? globalThis.fetch, input, init)) as typeof globalThis.fetch;
  const routes = {
    healthCheck: () => '/health',
    getCustomer: ({ customerId }: GetCustomerArgs) => `/customers/${encodeURIComponent(customerId)}`,
    getTicket: ({ ticketId }: GetTicketArgs) => `/tickets/${encodeURIComponent(ticketId)}`,
    escalateTicket: ({ ticketId }: EscalateTicketArgs) => `/tickets/${encodeURIComponent(ticketId)}/escalate`,
    ...options.routes,
  };
  const fetchJson = (apiPath: string, context?: ToolCallContext, init?: RequestInit) => requestJson(resolveBaseUrl(context), apiPath, {
    ...init,
    headers: {
      ...options.headers,
      ...init?.headers,
    },
  }, fetchImpl);

  return defineConnector({
    name: 'customer-api',
    description: 'Read customers and tickets from a demo or customer-owned API',
    config: {
      baseUrl,
      baseUrlEnv,
      customRoutes: Boolean(options.routes),
      customMappers: Boolean(options.mapCustomer ?? options.mapTicket ?? options.mapEscalation),
    },
    env: [
      {
        name: baseUrlEnv,
        required: false,
        description: 'Override the customer API base URL',
      },
    ],
    tools: [
      defineTool<CustomerApiHealthCheckArgs, CustomerApiHealthCheckResult>({
        name: 'customerApi.healthCheck',
        description: 'Verify that the customer API health endpoint responds successfully',
        scopes: ['customer:read'],
        environments: defaultToolEnvironments,
        category: 'health',
        tags: ['health', 'customer', 'read'],
        argsSchema: healthCheckArgsSchema,
        async handler(_args, context) {
          const startedAt = Date.now();
          const raw = await fetchJson(routes.healthCheck(), context);
          const record = asRecord(raw);

          return {
            ok: record.ok === undefined ? true : record.ok === true,
            latencyMs: Date.now() - startedAt,
          };
        },
      }),
      defineTool<GetCustomerArgs, unknown>({
        name: 'customer.get',
        description: 'Look up customer profile, subscription, and account context',
        scopes: ['customer:read'],
        environments: defaultToolEnvironments,
        category: 'context',
        tags: ['customer', 'read'],
        argsSchema: getCustomerArgsSchema,
        async handler(args, context) {
          const raw = await fetchJson(routes.getCustomer(args), context);
          return options.mapCustomer ? options.mapCustomer(raw as RawCustomer, args) : raw;
        },
      }),
      defineTool<GetTicketArgs, unknown>({
        name: 'ticket.get',
        description: 'Look up a support ticket with customer context',
        scopes: ['ticket:read'],
        environments: defaultToolEnvironments,
        category: 'context',
        tags: ['ticket', 'read'],
        argsSchema: getTicketArgsSchema,
        async handler(args, context) {
          const raw = await fetchJson(routes.getTicket(args), context);
          return options.mapTicket ? options.mapTicket(raw as RawTicket, args) : raw;
        },
      }),
      defineTool<EscalateTicketArgs, unknown>({
        name: 'ticket.escalate',
        description: 'Escalate a support ticket into the customer API escalation queue',
        scopes: ['ticket:write'],
        environments: defaultToolEnvironments,
        category: 'escalation',
        tags: ['action', 'escalation', 'ticket'],
        argsSchema: escalateTicketArgsSchema,
        async handler(args, context) {
          const raw = await fetchJson(routes.escalateTicket(args), context, {
            method: 'POST',
            body: JSON.stringify(options.escalationBody ? options.escalationBody(args) : {
              reason: args.reason,
              channel: args.channel,
            }),
          });
          return options.mapEscalation ? options.mapEscalation(raw as RawEscalation, args) : raw;
        },
      }),
    ],
  });
}
