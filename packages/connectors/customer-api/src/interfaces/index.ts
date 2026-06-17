import type { EnvironmentEndpointRef, HttpResilienceOptions } from '@fdekit/core';

export interface CustomerApiConnectorConfig {
  baseUrl: string;
  baseUrlEnv?: string;
  customRoutes?: boolean;
  customMappers?: boolean;
}

export interface CustomerApiHealthCheckArgs {}

export interface CustomerApiHealthCheckResult {
  ok: boolean;
  latencyMs: number;
}

export interface GetCustomerArgs {
  customerId: string;
}

export interface GetTicketArgs {
  ticketId: string;
}

export interface EscalateTicketArgs {
  ticketId: string;
  reason: string;
  channel?: string;
}

export interface CustomerApiRoutes {
  healthCheck?: () => string;
  getCustomer?: (args: GetCustomerArgs) => string;
  getTicket?: (args: GetTicketArgs) => string;
  escalateTicket?: (args: EscalateTicketArgs) => string;
}

export type CustomerApiMapper<Raw, Args, Result = unknown> = (raw: Raw, args: Args) => Result | Promise<Result>;

export interface CustomerApiConnectorOptions<
  RawCustomer = any,
  RawTicket = any,
  RawEscalation = any,
> {
  baseUrl?: string | EnvironmentEndpointRef;
  baseUrlEnv?: string;
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
  routes?: CustomerApiRoutes;
  mapCustomer?: CustomerApiMapper<RawCustomer, GetCustomerArgs>;
  mapTicket?: CustomerApiMapper<RawTicket, GetTicketArgs>;
  mapEscalation?: CustomerApiMapper<RawEscalation, EscalateTicketArgs>;
  escalationBody?: (args: EscalateTicketArgs) => unknown;
  resilience?: HttpResilienceOptions;
}
